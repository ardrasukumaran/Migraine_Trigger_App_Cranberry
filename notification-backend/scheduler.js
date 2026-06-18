// scheduler.js — runs every 30 mins, sends to users whose meal time matches now

import cron from "node-cron";
import { sendToToken }                      from "./fcm.js";
import { getActiveTokens, deactivateToken } from "./sheet.js";

// IST = UTC+5:30. Change if your users are in a different timezone.
const UTC_OFFSET_HOURS = parseFloat(process.env.UTC_OFFSET_HOURS ?? "5.5");

// ─── Notification messages ────────────────────────────────────────────────────
// UPDATE THESE with your actual notification text
const MESSAGES = {
  morning: {
    title: "Time for your morning supplements 🌿",
    body:  "Take your cranberry supplements with breakfast. Stay consistent!",
  },
  evening: {
    title: "Evening supplements reminder 🌙",
    body:  "Don't forget your night dose. Keep your streak going!",
  },
};

// ─── Check if "HH:MM" time is within ±15 minutes of now ──────────────────────
function isDueNow(timeStr) {
  if (!timeStr) return false;

  const parts = String(timeStr).split(":");
  const targetH = parseInt(parts[0], 10);
  const targetM = parseInt(parts[1], 10);
  if (isNaN(targetH) || isNaN(targetM)) return false;

  // Convert UTC to user's local time
  const now      = new Date();
  const localMs  = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local    = new Date(localMs);
  const nowMins  = local.getUTCHours() * 60 + local.getUTCMinutes();
  const targetMins = targetH * 60 + targetM;

  // ±15 minutes window (for 30-min scheduler)
  return Math.abs(nowMins - targetMins) <= 15;
}

// ─── Get current local time string ───────────────────────────────────────────
function getLocalTimeStr() {
  const now     = new Date();
  const localMs = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  return String(local.getUTCHours()).padStart(2,"0") + ":" +
         String(local.getUTCMinutes()).padStart(2,"0");
}

// ─── Main schedule runner ─────────────────────────────────────────────────────
async function runSchedule() {
  const timeStr = getLocalTimeStr();
  let tokens;

  try {
    tokens = await getActiveTokens();
  } catch (err) {
    console.error("[Scheduler] Failed to fetch tokens:", err.message);
    return;
  }

  if (!tokens.length) {
    console.log(`[Scheduler] ${timeStr} — no active tokens`);
    return;
  }

  let sent = 0;
  let skipped = 0;

  for (const row of tokens) {
    let msg  = null;
    let slot = null;

    if (isDueNow(row.dayTime)) {
      msg  = MESSAGES.morning;
      slot = "morning";
    } else if (isDueNow(row.nightTime)) {
      msg  = MESSAGES.evening;
      slot = "evening";
    }

    if (!msg) {
      skipped++;
      continue;
    }

    const result = await sendToToken({
      token: row.token,
      title: msg.title,
      body:  msg.body,
      url:   "/coach",
    });

    if (result.success) {
      sent++;
      console.log(`[Scheduler] ✓ ${slot} → ${row.mobile || row.token.slice(0,12)}… (${timeStr})`);
    } else {
      console.error(`[Scheduler] ✗ failed → ${row.mobile}:`, result.error);

      // Auto-deactivate invalid/unregistered tokens
      if (
        result.error?.includes("UNREGISTERED") ||
        result.error?.includes("INVALID_ARGUMENT") ||
        result.error?.includes("NOT_FOUND")
      ) {
        console.log(`[Scheduler] Deactivating stale token for ${row.mobile}`);
        deactivateToken(row.token);
      }
    }
  }

  if (sent > 0) {
    console.log(`[Scheduler] ${timeStr} IST — sent ${sent}/${tokens.length} notifications`);
  }
}

// ─── Start cron (every 30 minutes) ───────────────────────────────────────────
export function startScheduler() {
  console.log("[Scheduler] Started — runs every 30 minutes (UTC offset:", UTC_OFFSET_HOURS, "hrs)");
  console.log("[Scheduler] Notification window: ±15 minutes");

  // Run immediately on startup
  runSchedule();

  // Then every 30 minutes: 0 and 30 of every hour
  cron.schedule("0,30 * * * *", runSchedule);
}
