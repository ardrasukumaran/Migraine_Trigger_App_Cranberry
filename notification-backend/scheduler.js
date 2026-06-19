// scheduler.js — runs EXACTLY at fixed slot times (IST)
// Cron runs at UTC equivalents of IST slot times
//
// IST → UTC conversion (IST = UTC + 5:30):
// IST 08:00 = UTC 02:30
// IST 09:00 = UTC 03:30
// IST 10:00 = UTC 04:30
// IST 13:00 = UTC 07:30
// IST 14:00 = UTC 08:30
// IST 15:00 = UTC 09:30
// IST 19:00 = UTC 13:30
// IST 20:00 = UTC 14:30
// IST 21:00 = UTC 15:30
// IST 22:00 = UTC 16:30
// Cron: "30 2,3,4,7,8,9,13,14,15,16 * * *"

import cron from "node-cron";
import { sendToToken }                      from "./fcm.js";
import { getActiveTokens, deactivateToken } from "./sheet.js";

const UTC_OFFSET_HOURS = parseFloat(process.env.UTC_OFFSET_HOURS ?? "5.5");

// ─── Fixed time slots (IST) ───────────────────────────────────────────────────
const DAY_SLOTS   = ["08:00", "09:00", "10:00", "13:00", "14:00", "15:00"];
const NIGHT_SLOTS = ["19:00", "20:00", "21:00", "22:00"];

// ─── Build notification messages ─────────────────────────────────────────────
function buildMessages(dayCombo, nightCombo) {
  const day   = dayCombo   || "your supplements";
  const night = nightCombo || "your supplements";
  return {
    day: {
      title: "Cranberry · With lunch 🌿",
      body:  `Take ${day} with your lunch. Tap to mark them off.`,
    },
    night: {
      title: "Cranberry · With dinner 🌙",
      body:  `Take ${night} with your dinner. Tap to mark them off.`,
    },
  };
}

// ─── Get current IST time string "HH:MM" ─────────────────────────────────────
function getISTTimeStr() {
  const now     = new Date();
  const localMs = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  return String(local.getUTCHours()).padStart(2, "0") + ":" +
         String(local.getUTCMinutes()).padStart(2, "0");
}

// ─── Main schedule runner ─────────────────────────────────────────────────────
async function runSchedule() {
  const timeStr = getISTTimeStr();
  const isDay   = DAY_SLOTS.includes(timeStr);
  const isNight = NIGHT_SLOTS.includes(timeStr);

  console.log(`[Scheduler] ⏰ Running at ${timeStr} IST — ${isDay ? "DAY" : isNight ? "NIGHT" : "unknown"}`);

  let tokens;
  try {
    tokens = await getActiveTokens();
  } catch (err) {
    console.error("[Scheduler] Failed to fetch tokens:", err.message);
    return;
  }

  if (!tokens.length) {
    console.log("[Scheduler] No active tokens found.");
    return;
  }

  let sent = 0;

  for (const row of tokens) {
    // Only send to users whose time matches this slot
    const userTime = isDay ? row.dayTime : row.nightTime;
    if (userTime !== timeStr) continue;

    const msgs = buildMessages(row.dayCombo, row.nightCombo);
    const msg  = isDay ? msgs.day : msgs.night;
    const slot = isDay ? "day" : "night";

    const result = await sendToToken({
      token: row.token,
      title: msg.title,
      body:  msg.body,
      url:   "/coach",
    });

    if (result.success) {
      sent++;
      console.log(`[Scheduler] ✓ ${slot} → ${row.mobile} (${timeStr})`);
    } else {
      console.error(`[Scheduler] ✗ ${row.mobile}:`, result.error);
      if (
        result.error?.includes("UNREGISTERED") ||
        result.error?.includes("INVALID_ARGUMENT") ||
        result.error?.includes("NOT_FOUND")
      ) {
        deactivateToken(row.token);
      }
    }
  }

  console.log(`[Scheduler] ${timeStr} IST — sent ${sent}/${tokens.length}`);
}

// ─── Start cron — runs EXACTLY at slot times (UTC equivalent) ────────────────
export function startScheduler() {
  console.log("[Scheduler] Started — exact slot times only");
  console.log("[Scheduler] Day slots:  ", DAY_SLOTS.join(", "), "(IST)");
  console.log("[Scheduler] Night slots:", NIGHT_SLOTS.join(", "), "(IST)");
  console.log("[Scheduler] Runs 10 times/day only");

  // UTC: minute 30, at hours 2,3,4,7,8,9,13,14,15,16
  // = IST: 08:00, 09:00, 10:00, 13:00, 14:00, 15:00, 19:00, 20:00, 21:00, 22:00
  cron.schedule("30 2,3,4,7,8,9,13,14,15,16 * * *", runSchedule);
}
