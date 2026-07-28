import path from "node:path";
import crypto from "node:crypto";

const clientDir = path.resolve(process.cwd(), "dist/client");
const port = parseInt(process.env.PORT ?? "3000", 10);

const MIME: Record<string, string> = {
  ".html":        "text/html; charset=utf-8",
  ".css":         "text/css; charset=utf-8",
  ".js":          "application/javascript; charset=utf-8",
  ".mjs":         "application/javascript; charset=utf-8",
  ".json":        "application/json",
  ".webmanifest": "application/manifest+json",
  ".png":         "image/png",
  ".jpg":         "image/jpeg",
  ".jpeg":        "image/jpeg",
  ".svg":         "image/svg+xml",
  ".ico":         "image/x-icon",
  ".woff":        "font/woff",
  ".woff2":       "font/woff2",
  ".ttf":         "font/ttf",
};

// ── Session token ──────────────────────────────────────────────
function createSessionToken(phone: string): string {
  const secret = process.env.SESSION_SECRET ?? "cranberry-default-secret";
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ phone, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// ── Google Sheets (JWT auth, no googleapis package) ────────────
function b64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function b64urlBuf(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getGoogleAccessToken(creds: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss:   creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));
  const signingInput = `${header}.${payload}`;

  const pemBody = creds.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8", keyDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64urlBuf(sig)}`;

  const res  = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function readSheetRows(creds: any, spreadsheetId: string, sheetName: string): Promise<string[][]> {
  const token = await getGoogleAccessToken(creds);
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const v = await r.json() as { values?: string[][] };
  return v.values ? v.values.slice(1) : []; // skip header row
}

async function readAllSheetRows(creds: any, spreadsheetId: string): Promise<string[][]> {
  const token = await getGoogleAccessToken(creds);

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const meta = await metaRes.json() as { sheets?: Array<{ properties: { title: string } }> };
  const names = (meta.sheets ?? []).map(s => s.properties.title);

  const allRows: string[][] = [];
  for (const name of names) {
    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(name)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const v = await r.json() as { values?: string[][] };
    if (v.values) allRows.push(...v.values.slice(1)); // skip header row
  }
  return allRows;
}

// ── HTTP server ────────────────────────────────────────────────
Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // ── /api/send-otp ──────────────────────────────────────────
    if (url.pathname === "/api/send-otp") {
      const phone  = url.searchParams.get("phone") ?? "";
      const otp    = url.searchParams.get("otp")   ?? "";
      const apiKey = process.env.FAST2SMS_API_KEY;

      if (!apiKey || !phone || !otp) {
        return new Response(JSON.stringify({ ok: false, error: "missing params" }), {
          status: 400, headers: { "content-type": "application/json" },
        });
      }

      const number  = phone.replace(/\D/g, "").slice(-10);
      const message = `Your Cranberry OTP is ${otp}. Valid for 10 minutes.`;
      const f2sUrl  = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(message)}&flash=0&numbers=${number}`;

      try {
        const res  = await fetch(f2sUrl);
        const data = await res.json();
        console.log("[Fast2SMS]", JSON.stringify(data));
        return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
      } catch (err) {
        console.error("[Fast2SMS] request failed:", err);
        return new Response(JSON.stringify({ ok: false, error: "upstream failed" }), {
          status: 502, headers: { "content-type": "application/json" },
        });
      }
    }

    // ── /api/verify-user ───────────────────────────────────────
    if (url.pathname === "/api/verify-user" && req.method === "POST") {
      let body: { phone?: string; order_id?: string };
      try { body = await req.json(); } catch { body = {}; }

      const normalizedPhone = String(body.phone ?? "").replace(/\D/g, "").slice(-10);
      const orderId         = String(body.order_id ?? "").trim();

      if (!normalizedPhone || !orderId) {
        return new Response(JSON.stringify({ verified: false, message: "Missing phone or order ID" }), {
          status: 400, headers: { "content-type": "application/json" },
        });
      }

      const saJson  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const sheetId = process.env.GOOGLE_SHEET_ID;

      if (!saJson || !sheetId) {
        console.error("[verify-user] missing env vars");
        return new Response(JSON.stringify({ verified: false, message: "Server configuration error" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }

      try {
        const creds = JSON.parse(saJson);
        const rows  = await readAllSheetRows(creds, sheetId);

        let matchedRow: string[] | null = null;
        for (const row of rows) {
          const rowPhone   = String(row[3] ?? "").replace(/\D/g, "").slice(-10); // Column D
          const rowOrderId = String(row[1] ?? "").trim();                         // Column B (stored as #1001)
          if (rowPhone === normalizedPhone && rowOrderId === `#${orderId}`) {
            matchedRow = row;
            break;
          }
        }

        if (matchedRow) {
          const token    = createSessionToken(normalizedPhone);
          const userName = String(matchedRow[2] ?? "").trim(); // Column C = name
          console.log(`[verify-user] verified phone=${normalizedPhone} name=${userName}`);
          return new Response(JSON.stringify({ verified: true, message: "Success", token, phone: normalizedPhone, user_name: userName }), {
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ verified: false, message: "Invalid phone or order ID" }), {
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        console.error("[verify-user] error:", err);
        return new Response(JSON.stringify({ verified: false, message: "Verification failed. Please try again." }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }
    }

    // ── /api/period-baseline ──────────────────────────────────
    if (url.pathname === "/api/period-baseline" && req.method === "GET") {
      const phone   = url.searchParams.get("phone") ?? "";
      const saJson  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const sheetId = process.env.ATTACK_SHEET_ID;

      if (!phone) {
        return new Response(JSON.stringify({ error: "Missing phone" }), {
          status: 400, headers: { "content-type": "application/json" },
        });
      }
      if (!saJson || !sheetId) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }

      try {
        const creds = JSON.parse(saJson);
        const rows  = await readSheetRows(creds, sheetId, "Baseline Period Data");

        // Col A=phone(0), B=mode regular/irregular(1), C=periodLength(2),
        //     D=cycleLength(3), E=shortestCycle(4), F=longestCycle(5),
        //     G=baselinePrevPeriodDate YYYY-MM-DD(6)
        const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
        const row = rows.find(r =>
          String(r[0] ?? "").replace(/\D/g, "").slice(-10) === normalizedPhone
        );

        if (!row) {
          console.log(`[period-baseline] no row found for phone=${normalizedPhone}`);
          return new Response(JSON.stringify({ found: false }), {
            headers: { "content-type": "application/json" },
          });
        }

        const modeRaw      = String(row[1] ?? "").trim().toLowerCase();
        const mode         = modeRaw === "irregular" ? "irregular" : "regular";
        const periodLength  = parseInt(String(row[2] ?? "5"), 10) || 5;
        const cycleLength   = parseInt(String(row[3] ?? "28"), 10) || 28;
        const shortestCycle = parseInt(String(row[4] ?? ""), 10) || cycleLength;
        const longestCycle  = parseInt(String(row[5] ?? ""), 10) || cycleLength;
        const rawDate       = String(row[6] ?? "").trim();
        const baselinePrevPeriodDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

        console.log(`[period-baseline] phone=${normalizedPhone} mode=${mode} cycle=${cycleLength} period=${periodLength} baseline=${baselinePrevPeriodDate}`);
        return new Response(JSON.stringify({ found: true, mode, periodLength, cycleLength, shortestCycle, longestCycle, baselinePrevPeriodDate }), {
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        console.error("[period-baseline] error:", err);
        return new Response(JSON.stringify({ error: "Failed to fetch baseline" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }
    }

    // ── /api/triggers ─────────────────────────────────────────
    if (url.pathname === "/api/triggers" && req.method === "GET") {
      const phone   = url.searchParams.get("phone") ?? "";
      const saJson  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const sheetId = process.env.ATTACK_SHEET_ID;

      if (!phone) {
        return new Response(JSON.stringify({ error: "Missing phone" }), {
          status: 400, headers: { "content-type": "application/json" },
        });
      }
      if (!saJson || !sheetId) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }

      try {
        const creds = JSON.parse(saJson);
        const rows  = await readSheetRows(creds, sheetId, "Migraine_attack_log");

        // Col A = phone (index 0), F = food triggers (5), G = non-food (6)
        const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
        const userRows = rows.filter(row =>
          String(row[0] ?? "").replace(/\D/g, "").slice(-10) === normalizedPhone
        );

        const totalLogs = userRows.length;
        if (totalLogs === 0) {
          return new Response(JSON.stringify({ triggers: [] }), {
            headers: { "content-type": "application/json" },
          });
        }

        const counts: Record<string, number> = {};
        for (const row of userRows) {
          const food    = String(row[5] ?? "").split(",").map(s => s.trim()).filter(Boolean);
          const nonFood = String(row[6] ?? "").split(",").map(s => s.trim()).filter(Boolean);
          for (const t of [...food, ...nonFood]) {
            counts[t] = (counts[t] ?? 0) + 1;
          }
        }

        const triggers = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({
            name,
            count,
            correlation: Math.round((count / totalLogs) * 100),
          }));

        console.log(`[triggers] phone=${normalizedPhone} logs=${totalLogs} triggers=${triggers.length}`);
        return new Response(JSON.stringify({ triggers }), {
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        console.error("[triggers] error:", err);
        return new Response(JSON.stringify({ error: "Failed to fetch triggers" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }
    }

    // ── /api/attacks ──────────────────────────────────────────
    if (url.pathname === "/api/attacks" && req.method === "GET") {
      const phone   = url.searchParams.get("phone") ?? "";
      const saJson  = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const sheetId = process.env.ATTACK_SHEET_ID;

      if (!phone) {
        return new Response(JSON.stringify({ error: "Missing phone" }), {
          status: 400, headers: { "content-type": "application/json" },
        });
      }
      if (!saJson || !sheetId) {
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }

      try {
        const creds = JSON.parse(saJson);
        const rows  = await readSheetRows(creds, sheetId, "Migraine_attack_log");

        // Col A=phone(0), B=date(1), C=intensity(2), E=duration(4), F=food(5), G=nonFood(6)
        const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
        const matchedIndices: number[] = [];
        const attacks = rows
          .filter((row, i) => {
            const match = String(row[0] ?? "").replace(/\D/g, "").slice(-10) === normalizedPhone;
            if (match) matchedIndices.push(i + 2); // +2: 1-based + skip header
            return match;
          })
          .map(row => ({
            date:            String(row[1] ?? "").trim(),
            intensity:       parseInt(String(row[2] ?? "0"), 10) || 0,
            duration:        String(row[4] ?? "").trim(),
            foods:           String(row[5] ?? "").split(",").map(s => s.trim()).filter(Boolean),
            nonFoodTriggers: String(row[6] ?? "").split(",").map(s => s.trim()).filter(Boolean),
          }))
          .filter(a => a.date)
          .sort((a, b) => b.date.localeCompare(a.date));

        console.log(`[attacks] sheet=Migraine_attack_log totalRows=${rows.length} phone=${normalizedPhone} matched=${attacks.length} rows=[${matchedIndices.join(",")}]`);
        return new Response(JSON.stringify({ attacks }), {
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        console.error("[attacks] error:", err);
        return new Response(JSON.stringify({ error: "Failed to fetch attacks" }), {
          status: 500, headers: { "content-type": "application/json" },
        });
      }
    }

    // ── Static files ───────────────────────────────────────────
    const filePath = path.join(clientDir, url.pathname);
    if (!path.resolve(filePath).startsWith(clientDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      const ext = path.extname(filePath).toLowerCase();
      return new Response(file, { headers: { "content-type": MIME[ext] ?? "application/octet-stream" } });
    }

    return new Response(Bun.file(path.join(clientDir, "index.html")), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`Server listening on port ${port}`);
