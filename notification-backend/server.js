// server.js — Migraine Minder notification backend
// Uses Google Sheets API directly (no Apps Script middleman)

import "dotenv/config";
import express from "express";
import cron    from "node-cron";
import { sendViaOneSignal, sendToMany } from "./onesignal.js";
import { upsertToken, getActiveTokens, updateCombo, upsertStreak, batchUpsertStreak, batchUpdateCombo, getUserByMobile } from "./sheet.js";
import { startScheduler } from "./scheduler.js";

const app        = express();
const PORT       = process.env.PORT ?? 3000;
const SECRET     = process.env.API_SECRET;
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

// ─── Auth ─────────────────────────────────────────────────────────────────────
function requireSecret(req, res, next) {
  if (!SECRET) return next();
  const provided = req.headers["x-api-secret"] ?? req.body?.secret;
  if (provided !== SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Batch queue system — collects requests for 2 sec, then flushes as ONE call ─
// This handles the case where many users (e.g. 200+) save streak/combo at the
// same moment (e.g. right after a notification reminder fires)

const streakQueue = [];
let streakFlushTimer = null;

function queueStreak(entry) {
  streakQueue.push(entry);
  if (!streakFlushTimer) {
    streakFlushTimer = setTimeout(flushStreakQueue, 2000); // flush every 2 sec
  }
}

async function flushStreakQueue() {
  const batch = streakQueue.splice(0, streakQueue.length); // take all, clear queue
  streakFlushTimer = null;
  if (!batch.length) return;

  try {
    const result = await batchUpsertStreak(batch);
    console.log(`[save-streak] Batch flushed: ${result} (${batch.length} requests)`);
  } catch (err) {
    console.error("[save-streak] Batch flush failed:", err.message);
  }
}

const comboQueue = [];
let comboFlushTimer = null;

function queueCombo(entry) {
  comboQueue.push(entry);
  if (!comboFlushTimer) {
    comboFlushTimer = setTimeout(flushComboQueue, 2000);
  }
}

async function flushComboQueue() {
  const batch = comboQueue.splice(0, comboQueue.length);
  comboFlushTimer = null;
  if (!batch.length) return;

  try {
    const result = await batchUpdateCombo(batch);
    console.log(`[save-combo] Batch flushed: ${result} (${batch.length} requests)`);
  } catch (err) {
    console.error("[save-combo] Batch flush failed:", err.message);
  }
}

// ─── POST /register-token ─────────────────────────────────────────────────────
app.post("/register-token", async (req, res) => {
  const { mobile_number, fcm_token, day_combo, night_combo } = req.body ?? {};
  if (!fcm_token || fcm_token.length < 10)
    return res.status(400).json({ error: "Invalid token" });

  console.log(`[register-token] mobile=${mobile_number}`);

  try {
    const result = await upsertToken({
      token:      fcm_token,
      mobile:     mobile_number ?? "",
      dayCombo:   day_combo     ?? "",
      nightCombo: night_combo   ?? "",
    });
    res.json({ ok: true, sheet: result });
  } catch (err) {
    console.error("[register-token] Failed:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /user-info ───────────────────────────────────────────────────────────
app.get("/user-info", async (req, res) => {
  const mobile = req.query.mobile;
  if (!mobile) return res.status(400).json({ error: "mobile is required" });

  try {
    const data = await getUserByMobile(mobile);
    res.json({ ok: true, name: data.name ?? "", dayTime: data.dayTime ?? "", nightTime: data.nightTime ?? "" });
  } catch (err) {
    console.error("[user-info] Error:", err.message);
    res.json({ ok: false, name: "" });
  }
});

// ─── POST /save-combo ────────────────────────────────────────────────────────
// Queued and batched — handles many simultaneous saves reliably
app.post("/save-combo", async (req, res) => {
  const { phone, dayCombo, nightCombo } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  console.log(`[save-combo] queued phone=${phone} day=${dayCombo} night=${nightCombo}`);

  queueCombo({ mobile: phone, dayCombo, nightCombo });
  res.json({ ok: true, queued: true });
});

// ─── POST /save-streak ────────────────────────────────────────────────────────
// Queued and batched — handles 200+ simultaneous saves reliably
app.post("/save-streak", async (req, res) => {
  const { phone, date, type, supplements, score } = req.body ?? {};
  if (!phone) return res.status(400).json({ error: "phone is required" });

  console.log(`[save-streak] queued phone=${phone} type=${type} supplements=${supplements} score=${score}`);

  queueStreak({ phone, date, type, supplements, score });
  res.json({ ok: true, queued: true });
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
    platform:  "onesignal",
    sheet:     "google-sheets-api-direct",
  });
});

// ─── Smart keep-alive ─────────────────────────────────────────────────────────
function startSmartKeepAlive() {
  if (!RENDER_URL) {
    console.log("[Keep-alive] No RENDER_EXTERNAL_URL — skipping");
    return;
  }
  console.log("[Keep-alive] Smart ping — 5 min before each slot");
  cron.schedule("25 2,3,4,7,8,9,13,14,15,16,21 * * *", async () => {
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
