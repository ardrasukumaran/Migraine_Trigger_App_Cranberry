// server.js — Migraine Minder notification backend
// Endpoints:
//   POST /register-token  — save FCM token from browser
//   POST /send            — send to specific token(s) [protected]
//   POST /send-all        — send to ALL active tokens  [protected]
//   GET  /health          — health check

import "dotenv/config";
import express         from "express";
import { sendToToken, sendToMany } from "./fcm.js";
import { upsertToken, getActiveTokens } from "./sheet.js";
import { startScheduler } from "./scheduler.js";

const app    = express();
const PORT   = process.env.PORT ?? 3000;
const SECRET = process.env.API_SECRET;

app.use(express.json());

// ─── CORS — allow the Lovable app to call this backend ────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-secret");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Auth middleware (for protected routes) ───────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next(); // no secret set → open (dev only)
  const provided = req.headers["x-api-secret"] ?? req.body?.secret;
  if (provided !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── POST /register-token ─────────────────────────────────────────────────────
// Called by the browser when a user enables notifications.
// Body: { token, mobile, dayTime?, nightTime? }
app.post("/register-token", async (req, res) => {
  const { token, mobile, dayTime, nightTime } = req.body ?? {};

  if (!token || token.length < 10) {
    return res.status(400).json({ error: "Invalid token" });
  }

  console.log(`[register-token] mobile=${mobile} token=${token.slice(0,20)}…`);

  const result = await upsertToken({
    token,
    mobile:    mobile    ?? "",
    dayTime:   dayTime   ?? "12:30",
    nightTime: nightTime ?? "19:30",
  });

  res.json({ ok: true, sheet: result });
});

// ─── POST /send ───────────────────────────────────────────────────────────────
// Send to one or more specific tokens.
// Body: { tokens: string[], title, body, url?, secret? }
app.post("/send", requireSecret, async (req, res) => {
  const { tokens, title, body, url } = req.body ?? {};

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: "tokens[] is required" });
  }
  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }

  const result = await sendToMany({ tokens, title, body, url });
  console.log(`[send] sent=${result.sent} failed=${result.failed} total=${result.total}`);
  res.json({ ok: true, ...result });
});

// ─── POST /send-all ───────────────────────────────────────────────────────────
// Broadcast to ALL active tokens in the sheet right now.
// Body: { title, body, url?, secret? }
app.post("/send-all", requireSecret, async (req, res) => {
  const { title, body, url } = req.body ?? {};

  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required" });
  }

  const rows   = await getActiveTokens();
  const tokens = rows.map((r) => r.token).filter(Boolean);

  if (tokens.length === 0) {
    return res.json({ ok: true, sent: 0, message: "No active tokens" });
  }

  const result = await sendToMany({ tokens, title, body, url });
  console.log(`[send-all] sent=${result.sent} failed=${result.failed} total=${result.total}`);
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

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Notification server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
  startScheduler();
});
