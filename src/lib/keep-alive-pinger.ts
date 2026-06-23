// src/lib/keep-alive-pinger.ts
// Runs on the FRONTEND server (Pro plan - never sleeps)
// Pings the notification backend 5 minutes before each slot
// This keeps the FREE tier notification backend awake for scheduled notifications

const NOTIFICATION_BACKEND = "https://cranberry-notifications.onrender.com/health";
const UTC_OFFSET_HOURS = 5.5;

// Ping times (UTC) = 5 min before each IST slot
// IST slots: 8,9,10 AM, 1,2,3 PM, 7,8,9,10 PM
// UTC keep-alive: 25 min of hours 2,3,4,7,8,9,13,14,15,16
const KEEPALIVE_SLOTS_UTC = [
  { h: 2,  m: 25 }, // IST 7:55 AM
  { h: 3,  m: 25 }, // IST 8:55 AM
  { h: 4,  m: 25 }, // IST 9:55 AM
  { h: 7,  m: 25 }, // IST 12:55 PM
  { h: 8,  m: 25 }, // IST 1:55 PM
  { h: 9,  m: 25 }, // IST 2:55 PM
  { h: 13, m: 25 }, // IST 6:55 PM
  { h: 14, m: 25 }, // IST 7:55 PM
  { h: 15, m: 25 }, // IST 8:55 PM
  { h: 16, m: 25 }, // IST 9:55 PM
];

async function pingNotificationServer() {
  try {
    const res = await fetch(NOTIFICATION_BACKEND);
    console.log(`[KeepAlive-Pinger] ✓ Pinged notification server → ${res.status}`);
  } catch (err: any) {
    console.error("[KeepAlive-Pinger] ✗ Ping failed:", err.message);
  }
}

function checkAndPing() {
  const now     = new Date();
  const utcH    = now.getUTCHours();
  const utcM    = now.getUTCMinutes();

  const isSlot = KEEPALIVE_SLOTS_UTC.some(
    (slot) => slot.h === utcH && utcM >= slot.m && utcM <= slot.m + 1
  );

  if (isSlot) {
    console.log(`[KeepAlive-Pinger] Slot time — pinging notification server...`);
    pingNotificationServer();
  }
}

export function startKeepAlivePinger() {
  console.log("[KeepAlive-Pinger] Started — will ping notification server before each slot");
  // Check every minute
  setInterval(checkAndPing, 60 * 1000);
}
