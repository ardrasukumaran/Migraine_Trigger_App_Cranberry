// scheduler.js — runs EXACTLY at fixed slot times (IST)
// Logs every notification sent to Google Sheet (Notification Logs tab)

import cron from "node-cron";
import { sendToToken }                      from "./fcm.js";
import { getActiveTokens, deactivateToken } from "./sheet.js";

const UTC_OFFSET_HOURS = parseFloat(process.env.UTC_OFFSET_HOURS ?? "5.5");
const SHEET_WEBHOOK    = process.env.SHEET_WEBHOOK_URL;

// ─── Fixed time slots (IST) ───────────────────────────────────────────────────
const DAY_SLOTS   = ["08:00", "09:00", "10:00", "13:00", "14:00", "15:00"];
const NIGHT_SLOTS = ["19:00", "20:00", "21:00", "22:00"];

// ─── Notification messages ────────────────────────────────────────────────────
function buildMessages(dayCombo, nightCombo) {
  const day   = dayCombo   || "your supplements";
  const night = nightCombo || "your supplements";
  return {
    day: {
      title: "Cranberry · With lunch 🌿",
      body:  `Take ${day} with your lunch. Tap to mark them off.`,
      url:   "/coach?view=morning",
    },
    night: {
      title: "Cranberry · With dinner 🌙",
      body:  `Take ${night} with your dinner. Tap to mark them off.`,
      url:   "/coach?view=evening",
    },
  };
}

// ─── Get current IST time ─────────────────────────────────────────────────────
function getISTTimeStr() {
  const now     = new Date();
  const localMs = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  return String(local.getUTCHours()).padStart(2, "0") + ":" +
         String(local.getUTCMinutes()).padStart(2, "0");
}

// ─── Log notification to Google Sheet ────────────────────────────────────────
async function logToSheet(mobile, token, time, status) {
  if (!SHEET_WEBHOOK) return;
  try {
    await fetch(SHEET_WEBHOOK, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        action: "log",
        record: { mobile, token, time, status },
      }),
    });
  } catch (err) {
    console.error("[Scheduler] Log failed:", err.message);
  }
}

// ─── Main schedule runner ─────────────────────────────────────────────────────
async function runSchedule() {
  const timeStr = getISTTimeStr();
  const isDay   = DAY_SLOTS.includes(timeStr);
  const isNight = NIGHT_SLOTS.includes(timeStr);

  if (!isDay && !isNight) return;

  console.log(`[Scheduler] ⏰ Slot: ${timeStr} IST — ${isDay ? "DAY" : "NIGHT"}`);

  let tokens;
  try {
    tokens = await getActiveTokens();
  } catch (err) {
    console.error("[Scheduler] Failed to fetch tokens:", err.message);
    return;
  }

  if (!tokens.length) {
    console.log("[Scheduler] No active tokens.");
    return;
  }

  let sent = 0;

  for (const row of tokens) {
    const userTime = isDay ? row.dayTime : row.nightTime;
    console.log(`[Scheduler] Checking ${row.mobile}: userTime=${userTime} slotTime=${timeStr} match=${userTime === timeStr}`);
    if (userTime !== timeStr) continue;

    const msgs   = buildMessages(row.dayCombo, row.nightCombo);
    const msg    = isDay ? msgs.day : msgs.night;
    const slot   = isDay ? "day" : "night";
    const result = await sendViaOneSignal({
      playerId: row.token,
      title:    msg.title,
      body:     msg.body,
      url:      msg.url,
    });

    if (result.success) {
      sent++;
      console.log(`[Scheduler] ✓ ${slot} → ${row.mobile} (${timeStr})`);
      logToSheet(row.mobile, row.token, timeStr, "Sent");
    } else {
      console.error(`[Scheduler] ✗ ${row.mobile}:`, result.error);
      logToSheet(row.mobile, row.token, timeStr, "Failed");
    }
  }

  console.log(`[Scheduler] ${timeStr} IST — ${isDay ? "DAY" : "NIGHT"} — sent ${sent}/${tokens.length}`);
}

// ─── Start cron — exactly at slot times (UTC) ─────────────────────────────────
// IST 08:00=UTC 02:30, 09:00=03:30, 10:00=04:30
// IST 13:00=UTC 07:30, 14:00=08:30, 15:00=09:30
// IST 19:00=UTC 13:30, 20:00=14:30, 21:00=15:30, 22:00=16:30
export function startScheduler() {
  console.log("[Scheduler] Started — exact slot times only");
  console.log("[Scheduler] Day slots:  ", DAY_SLOTS.join(", "), "(IST)");
  console.log("[Scheduler] Night slots:", NIGHT_SLOTS.join(", "), "(IST)");
  console.log("[Scheduler] Runs 10 times/day + logs to sheet");

  cron.schedule("30 2,3,4,7,8,9,13,14,15,16 * * *", runSchedule);
}
