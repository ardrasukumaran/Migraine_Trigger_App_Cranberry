// scheduler.js — runs EXACTLY at fixed slot times (IST)
// Logs every notification sent to Google Sheet (batch, via direct Sheets API)

import cron from "node-cron";
import { sendViaOneSignal } from "./onesignal.js";
import { getActiveTokens, batchLogNotifications } from "./sheet.js";

const UTC_OFFSET_HOURS = parseFloat(process.env.UTC_OFFSET_HOURS ?? "5.5");

// ─── Fixed time slots (IST) ───────────────────────────────────────────────────
const DAY_SLOTS   = ["08:00", "09:00", "09:30", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const NIGHT_SLOTS = ["19:00", "20:00", "21:00", "21:30", "22:00", "23:00", "00:00", "03:00", "04:00"];

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

// ─── Chunk helper — split array into groups of N ─────────────────────────────
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const SEND_CHUNK_SIZE = 20; // send 20 notifications in parallel at a time

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

  // Filter to only users matching this exact slot time
  const matchingRows = tokens.filter(row => {
    const userTime = isDay ? row.dayTime : row.nightTime;
    return userTime === timeStr;
  });

  if (!matchingRows.length) {
    console.log(`[Scheduler] ${timeStr} IST — no users match this slot.`);
    return;
  }

  let sent = 0;
  const logEntries = [];
  const slot = isDay ? "day" : "night";

  // Send in parallel chunks of SEND_CHUNK_SIZE — fast even for 300+ users
  const chunks = chunkArray(matchingRows, SEND_CHUNK_SIZE);

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (row) => {
        const msgs = buildMessages(row.dayCombo, row.nightCombo);
        const msg  = isDay ? msgs.day : msgs.night;
        const result = await sendViaOneSignal({
          playerId: row.token,
          title:    msg.title,
          body:     msg.body,
          url:      msg.url,
        });
        return { row, result };
      })
    );

    for (const settled of results) {
      if (settled.status !== "fulfilled") {
        console.error("[Scheduler] Unexpected send error:", settled.reason);
        continue;
      }
      const { row, result } = settled.value;

      if (result.success) {
        sent++;
        console.log(`[Scheduler] ✓ ${slot} → ${row.mobile} (${timeStr})`);
        logEntries.push({ mobile: row.mobile, token: row.token, time: timeStr, status: "Sent" });
      } else {
        console.error(`[Scheduler] ✗ ${row.mobile}:`, result.error);
        logEntries.push({ mobile: row.mobile, token: row.token, time: timeStr, status: "Failed" });
      }
    }
  }

  // Batch log all entries in ONE request — reliable even with 250+ users
  if (logEntries.length) {
    try {
      const result = await batchLogNotifications(logEntries);
      console.log(`[Scheduler] Logged: ${result}`);
    } catch (err) {
      console.error("[Scheduler] Batch log failed:", err.message);
    }
  }

  console.log(`[Scheduler] ${timeStr} IST — ${isDay ? "DAY" : "NIGHT"} — sent ${sent}/${matchingRows.length}`);
}

// ─── Start cron — exactly at slot times (UTC) ─────────────────────────────────
// IST 08:00=UTC 02:30, 09:00=03:30, 09:30=UTC 04:00, 10:00=04:30
// IST 11:00=UTC 05:30
// IST 13:00=UTC 07:30, 14:00=08:30, 15:00=09:30
// IST 19:00=UTC 13:30, 20:00=14:30, 21:00=15:30, 21:30=UTC 16:00, 22:00=16:30
// IST 23:00=UTC 17:30, 00:00=UTC 18:30
// IST 03:00=UTC 21:30, 04:00=UTC 22:30
export function startScheduler() {
  console.log("[Scheduler] Started — exact slot times only");
  console.log("[Scheduler] Day slots:  ", DAY_SLOTS.join(", "), "(IST)");
  console.log("[Scheduler] Night slots:", NIGHT_SLOTS.join(", "), "(IST)");
  console.log("[Scheduler] Runs 16 times/day + batch logs to sheet");

  // Slots that fall on :30 UTC (most slots)
  cron.schedule("30 2,3,4,5,6,7,8,9,13,14,15,16,17,18,21,22 * * *", runSchedule);
  // Slots that fall on :00 UTC — IST 09:30 (UTC 04:00) and IST 21:30 (UTC 16:00)
  cron.schedule("0 4,16 * * *", runSchedule);
}
