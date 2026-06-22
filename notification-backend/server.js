// server.js — Migraine Minder notification backend

import "dotenv/config";
import express from "express";
import cron    from "node-cron";
import { sendToToken, sendToMany } from "./fcm.js";
import { upsertToken, getActiveTokens } from "./sheet.js";
import { startScheduler } from "./scheduler.js";

const app        = express();
const PORT       = process.env.PORT ?? 3000;
const SECRET     = process.env.API_SECRET;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL ?? "";
const WEBHOOK    = process.env.SHEET_WEBHOOK_URL;

app.use(express.json());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next();
  const provided = req.headers["x-api-secret"] ?? req.body?.secret;
  if (provided !== SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── POST /register-token ─────────────────────────────────────────────────────
app.post("/register-token", async (req, res) => {
  const { mobile_number, fcm_token, day_combo, night_combo } = req.body ?? {};
  if (!fcm_token || fcm_token.length < 10)
    return res.status(400).json({ error: "Invalid token" });

  console.log(`[register-token] mobile=${mobile_number}`);
  const result = await upsertToken({
    token:      fcm_token,
    mobile:     mobile_number ?? "",
    dayCombo:   day_combo     ?? "",
    nightCombo: night_combo   ?? "",
  });
  res.json({ ok: true, sheet: result });
});

// ─── GET /user-info ───────────────────────────────────────────────────────────
app.get("/user-info", async (req, res) => {
  const mobile = req.query.mobile;
  if (!mobile) return res.status(400).json({ error: "mobile is required" });

  try {
    const response = await fetch(`${WEBHOOK}?action=getUser&mobile=${mobile}`);
    const data = await response.json();
    res.json({ ok: true, name: data.name ?? "", dayTime: data.dayTime ?? "", nightTime: data.nightTime ?? "" });
  } catch (err) {
    console.error("[user-info] Error:", err);
    res.json({ ok: false, name: "" });
  }
});

// ─── POST /save-combo ────────────────────────────────────────────────────────
app.post("/save-combo", async (req, res) => {
  const { phone, dayCombo, nightCombo } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  console.log(`[save-combo] phone=${phone} day=${dayCombo} night=${nightCombo}`);

  if (WEBHOOK) {
    fetch(WEBHOOK, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action: "updateCombo",
        record: {
          mobile:     phone,
          dayCombo:   dayCombo   ?? "",
          nightCombo: nightCombo ?? "",
        },
      }),
    }).catch((err) => console.error("[save-combo] Sheet sync failed:", err));
  }

  res.json({ ok: true });
});

// ─── POST /save-streak ────────────────────────────────────────────────────────
// Called when user saves supplement log in the app
// Body: { phone, date, type, supplements, score }
app.post("/save-streak", async (req, res) => {
  const { phone, date, type, supplements, score } = req.body ?? {};

  if (!phone) return res.status(400).json({ error: "phone is required" });

  console.log(`[save-streak] phone=${phone} type=${type} supplements=${supplements} score=${score}`);

  // Fire and forget to Google Sheet
  if (WEBHOOK) {
    fetch(WEBHOOK, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action: "logStreak",
        record: { phone, date, type, supplements, score },
      }),
    }).catch((err) => console.error("[save-streak] Sheet sync failed:", err));
  }

  res.json({ ok: true });
});

// ─── POST /send ───────────────────────────────────────────────────────────────
app.post("/send", requireSecret, async (req, res) => {
  const { tokens, title, body, url } = req.body ?? {};
  if (!Array.isArray(tokens) || !tokens.length)
    return res.status(400).json({ error: "tokens[] required" });
  if (!title || !body)
    return res.status(400).json({ error: "title and body required" });
  const result = await sendToMany({ tokens, title, body, url });
  res.json({ ok: true, ...result });
});

// ─── POST /send-all ───────────────────────────────────────────────────────────
app.post("/send-all", requireSecret, async (req, res) => {
  const { title, body, url } = req.body ?? {};
  if (!title || !body)
    return res.status(400).json({ error: "title and body required" });
  const rows   = await getActiveTokens();
  const tokens = rows.map((r) => r.token).filter(Boolean);
  if (!tokens.length)
    return res.json({ ok: true, sent: 0, message: "No active tokens" });
  const result = await sendToMany({ tokens, title, body, url });
  res.json({ ok: true, ...result });
});

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    ok:        true,
    service:   "migraine-notification-backend",
    timestamp: new Date().toISOString(),
    project:   process.env.FIREBASE_PROJECT_ID ?? "not set",
    sheet:     process.env.SHEET_WEBHOOK_URL ? "configured" : "not set",
  });
});

// ─── Smart keep-alive ─────────────────────────────────────────────────────────
function startSmartKeepAlive() {
  if (!RENDER_URL) {
    console.log("[Keep-alive] No RENDER_EXTERNAL_URL — skipping");
    return;
  }
  console.log("[Keep-alive] Smart ping — 5 min before each slot");
  cron.schedule("25 2,3,4,7,8,9,13,14,15,16 * * *", async () => {
    try {
      const r = await fetch(`${RENDER_URL}/health`);
      console.log(`[Keep-alive] ✓ Ping → ${r.status}`);
    } catch (err) {
      console.error("[Keep-alive] ✗ Ping failed:", err.message);
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Notification server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  startScheduler();
  startSmartKeepAlive();
});
