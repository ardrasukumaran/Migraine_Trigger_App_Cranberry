// scheduler.js — fires every 30 min, matches each user's day/night time dynamically

import cron from "node-cron";
import { sendViaOneSignal } from "./onesignal.js";
import { getActiveTokens, batchLogNotifications } from "./sheet.js";

const UTC_OFFSET_HOURS = parseFloat(process.env.UTC_OFFSET_HOURS ?? "5.5");
const SEND_CHUNK_SIZE  = 20;

// ─── In-memory dedup — prevents a double-send if cron fires twice for the same slot ─
const firedSlots = new Set();

// ─── Notification messages ────────────────────────────────────────────────────────
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

// ─── Current IST slot (HH:MM, rounded DOWN to nearest :00 or :30) ────────────────
// A run that fires a few seconds late still matches the intended slot.
function getISTSlot() {
  const now     = new Date();
  const localMs = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  const h       = local.getUTCHours();
  const m       = local.getUTCMinutes();
  const slotMin = m >= 30 ? 30 : 0;
  return `${String(h).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`;
}

// ─── Current IST date (YYYY-MM-DD) ───────────────────────────────────────────────
function getISTDate() {
  const now     = new Date();
  const localMs = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  return local.toISOString().slice(0, 10);
}

// ─── Chunk helper — split array into groups of N ─────────────────────────────────
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Main schedule runner ─────────────────────────────────────────────────────────
export async function runSchedule() {
  const slot    = getISTSlot();
  const date    = getISTDate();
  const slotKey = `${date} ${slot}`;

  if (firedSlots.has(slotKey)) {
    console.log(`[Scheduler] ${slot} IST — already ran for ${date}, skipping.`);
    return;
  }

  // Mark fired optimistically; remove if token fetch fails so a manual retry works.
  if (firedSlots.size >= 200) firedSlots.clear();
  firedSlots.add(slotKey);

  console.log(`[Scheduler] ⏰ Slot: ${slot} IST`);

  let tokens;
  try {
    tokens = await getActiveTokens();
  } catch (err) {
    console.error("[Scheduler] Failed to fetch tokens:", err.message);
    firedSlots.delete(slotKey);
    return;
  }

  if (!tokens.length) {
    console.log("[Scheduler] No active tokens.");
    return;
  }

  // Match users by the column that holds this slot's time.
  // The column that matched decides which message (day vs night).
  const dayMatches   = tokens.filter(row => row.dayTime   === slot);
  const nightMatches = tokens.filter(row => row.nightTime === slot);

  if (!dayMatches.length && !nightMatches.length) {
    console.log(`[Scheduler] ${slot} IST — no users match this slot.`);
    return;
  }

  let sent = 0;
  const logEntries = [];

  for (const [matchingRows, slotType] of [[dayMatches, "day"], [nightMatches, "night"]]) {
    if (!matchingRows.length) continue;

    const chunks = chunkArray(matchingRows, SEND_CHUNK_SIZE);
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (row) => {
          const msgs = buildMessages(row.dayCombo, row.nightCombo);
          const msg  = slotType === "day" ? msgs.day : msgs.night;
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
          console.log(`[Scheduler] ✓ ${slotType} → ${row.mobile} (${slot})`);
          logEntries.push({ mobile: row.mobile, token: row.token, time: slot, status: "Sent" });
        } else {
          console.error(`[Scheduler] ✗ ${row.mobile}:`, result.error);
          logEntries.push({ mobile: row.mobile, token: row.token, time: slot, status: "Failed" });
        }
      }
    }
  }

  if (logEntries.length) {
    try {
      const result = await batchLogNotifications(logEntries);
      console.log(`[Scheduler] Logged: ${result}`);
    } catch (err) {
      console.error("[Scheduler] Batch log failed:", err.message);
    }
  }

  const total = dayMatches.length + nightMatches.length;
  console.log(`[Scheduler] ${slot} IST — day:${dayMatches.length} night:${nightMatches.length} — sent ${sent}/${total}`);
}

// ─── Dry-run helper — returns match info without sending ─────────────────────────
export async function dryRunSlot(timeStr) {
  const tokens = await getActiveTokens();

  const dayMatches   = tokens.filter(row => row.dayTime   === timeStr);
  const nightMatches = tokens.filter(row => row.nightTime === timeStr);

  const matched = [
    ...dayMatches.map(r   => ({ mobile: r.mobile, dayTime: r.dayTime, nightTime: r.nightTime, slot: "day"   })),
    ...nightMatches.map(r => ({ mobile: r.mobile, dayTime: r.dayTime, nightTime: r.nightTime, slot: "night" })),
  ];

  // Users with at least one unreadable time (formatTime returned "")
  const unreadable = tokens
    .filter(row => !row.dayTime || !row.nightTime)
    .map(row => ({ mobile: row.mobile, dayTime: row.dayTime || "(empty)", nightTime: row.nightTime || "(empty)" }));

  return {
    timeStr,
    totalUsers:    tokens.length,
    matched:       matched.length,
    users:         matched,
    unreadable,
    allDayTimes:   [...new Set(tokens.map(r => r.dayTime).filter(Boolean))].sort(),
    allNightTimes: [...new Set(tokens.map(r => r.nightTime).filter(Boolean))].sort(),
  };
}

// ─── Start scheduler — every :00 and :30 UTC (covers every IST :00 and :30) ──────
export function startScheduler() {
  console.log("[Scheduler] Started — every 30 min, dynamic slot matching");
  cron.schedule("0,30 * * * *", runSchedule);
}
