// sheet.js — Google Sheet operations via Apps Script webhook

const WEBHOOK = process.env.SHEET_WEBHOOK_URL;

// ─── Convert any time format to "HH:MM" ──────────────────────────────────────
// Handles: "10 AM", "10 PM", "8:30 AM", "20:00", "08:00:00", Date objects
export function formatTime(val) {
  if (!val) return null;

  const str = String(val).trim();

  // Already in HH:MM or HH:MM:SS format
  if (/^\d{1,2}:\d{2}/.test(str)) {
    const parts = str.split(":");
    return parts[0].padStart(2, "0") + ":" + parts[1];
  }

  // "10 AM" / "10 PM" / "8:30 AM" / "8:30 PM"
  const ampm = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const period = ampm[3].toUpperCase();

    if (period === "AM" && h === 12) h = 0;
    if (period === "PM" && h !== 12) h += 12;

    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  // Date object from Google Sheets
  if (val instanceof Date) {
    return String(val.getHours()).padStart(2, "0") + ":" +
           String(val.getMinutes()).padStart(2, "0");
  }

  return null;
}

// ─── Get all active tokens from sheet ────────────────────────────────────────
export async function getActiveTokens() {
  if (!WEBHOOK) throw new Error("SHEET_WEBHOOK_URL is not set");

  try {
    const res = await fetch(`${WEBHOOK}?action=list`, { method: "GET" });
    if (!res.ok) {
      console.error("[Sheet] list failed:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    const tokens = data.tokens ?? [];

    // Normalize times on the way in
    return tokens.map((row) => ({
      ...row,
      dayTime:   formatTime(row.dayTime),
      nightTime: formatTime(row.nightTime),
    }));

  } catch (err) {
    console.error("[Sheet] getActiveTokens error:", err.message);
    return [];
  }
}

// ─── Upsert a token ───────────────────────────────────────────────────────────
export async function upsertToken({ token, mobile, dayTime, nightTime }) {
  if (!WEBHOOK) throw new Error("SHEET_WEBHOOK_URL is not set");

  const res = await fetch(WEBHOOK, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      action: "upsert",
      record: { token, mobile, dayTime, nightTime },
    }),
  });

  return res.ok ? await res.json() : { ok: false, error: await res.text() };
}

// ─── Deactivate a stale token ─────────────────────────────────────────────────
export async function deactivateToken(token) {
  if (!WEBHOOK) return;

  fetch(WEBHOOK, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ action: "deactivate", record: { token } }),
  }).catch((err) => console.error("[Sheet] deactivate error:", err.message));
}
