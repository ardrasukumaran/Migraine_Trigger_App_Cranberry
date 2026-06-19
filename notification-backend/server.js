// server.js — Migraine Minder notification backend

import "dotenv/config";
import express from "express";
import { sendToToken, sendToMany } from "./fcm.js";
import { upsertToken, getActiveTokens } from "./sheet.js";
import { startScheduler } from "./scheduler.js";

const app    = express();
const PORT   = process.env.PORT ?? 3000;
const SECRET = process.env.API_SECRET;

// Render URL — used for keep-alive ping
const RENDER_URL = process.env.RENDER_EXTERNAL_URL ?? "";

app.use(express.json());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next();
  const provided = req.headers["x-api-secret"] ?? req.body?.secret;
  if (provided !== SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── POST /register-token ─────────────────────────────────────────────────────
app.post("/register-token", async (req, res) => {
  const { mobile_number, fcm_token, day_combo, night_combo } = req.body ?? {};

  if (!fcm_token || fcm_token.length < 10) {
    return res.status(400).json({ error: "Invalid token" });
  }

  console.log(`[register-token] mobile=${mobile_number} day=${day_combo} night=${night_combo}`);

  const result = await upsertToken({
    token:      fcm_token,
    mobile:     mobile_number ?? "",
    dayCombo:   day_combo     ?? "",
    nightCombo: night_combo   ?? "",
  });

  res.json({ ok: true, sheet: result });
});

// ─── POST /send ───────────────────────────────────────────────────────────────
app.post("/send", requireSecret, async (req, res) => {
  const { tokens, title, body, url } = req.body ?? {};
  if (!Array.isArray(tokens) || tokens.length === 0)
    return res.status(400).json({ error: "tokens[] is required" });
  if (!title || !body)
    return res.status(400).json({ error: "title and body are required" });

  const result = await sendToMany({ tokens, title, body, url });
  res.json({ ok: true, ...result });
});

// ─── POST /send-all ───────────────────────────────────────────────────────────
app.post("/send-all", requireSecret, async (req, res) => {
  const { title, body, url } = req.body ?? {};
  if (!title || !body)
    return res.status(400).json({ error: "title and body are required" });

  const rows   = await getActiveTokens();
  const tokens = rows.map((r) => r.token).filter(Boolean);

  if (tokens.length === 0)
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

// ─── Keep-alive ping (prevents Render free tier from sleeping) ────────────────
function startKeepAlive() {
  if (!RENDER_URL) {
    console.log("[Keep-alive] No RENDER_EXTERNAL_URL set — skipping");
    return;
  }

  console.log("[Keep-alive] Pinging every 14 minutes:", RENDER_URL);

  setInterval(async () => {
    try {
      const res = await fetch(`${RENDER_URL}/health`);
      console.log("[Keep-alive] Ping:", res.status === 200 ? "✓" : "✗");
    } catch (err) {
      console.error("[Keep-alive] Ping failed:", err.message);
    }
  }, 14 * 60 * 1000); // every 14 minutes
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Notification server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  startScheduler();
  startKeepAlive();
});
