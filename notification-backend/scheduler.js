// scheduler.js — runs every 30 mins, sends to users whose meal time matches now

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

// ─── Get current local time string "HH:MM" ───────────────────────────────────
function getLocalTimeStr() {
  const now     = new Date();
  const localMs = now.getTime() + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  return String(local.getUTCHours()).padStart(2, "0") + ":" +
         String(local.getUTCMinutes()).padStart(2, "0");
}

// ─── Check if current time matches any slot (±2 min) ─────────────────────────
function matchesSlot(slots, currentTime) {
  const [ch, cm] = currentTime.split(":").map(Number);
  const nowMins  = ch * 60 + cm;

  return slots.some((slot) => {
    const [sh, sm] = slot.split(":").map(Number);
    return Math.abs(nowMins - (sh * 60 + sm)) <= 2;
  });
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

  if (!tokens.length) return;

  const isDay   = matchesSlot(DAY_SLOTS,   timeStr);
  const isNight = matchesSlot(NIGHT_SLOTS, timeStr);

  // Not a notification time — skip silently
  if (!isDay && !isNight) return;

  let sent = 0;

  for (const row of tokens) {
    // Build message using user's combo from sheet
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

  if (sent > 0) {
    console.log(`[Scheduler] ${timeStr} IST — ${isDay ? "DAY" : "NIGHT"} — sent ${sent}/${tokens.length}`);
  }
}

// ─── Start cron (every 30 minutes) ───────────────────────────────────────────
export function startScheduler() {
  console.log("[Scheduler] Started — runs every 30 minutes (UTC offset:", UTC_OFFSET_HOURS, "hrs)");
  console.log("[Scheduler] Day slots:  ", DAY_SLOTS.join(", "));
  console.log("[Scheduler] Night slots:", NIGHT_SLOTS.join(", "));

  runSchedule();
  cron.schedule("0,30 * * * *", runSchedule);
}
