// test-format-time.js — verify formatTime and getISTSlot without any imports
// Run: node test-format-time.js

// ── Inline copy of the new formatTime ────────────────────────────────────────
function formatTime(raw) {
  const str = String(raw ?? "").trim();
  if (!str) return "";

  // Pure 24-hour: H:MM or HH:MM[:SS]
  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h > 23 || m > 59) return "";
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 12-hour with AM/PM: H [sep MM [:SS]] AM/PM  (sep = : or ., space optional)
  const mAP = str.match(/^(\d{1,2})(?:[:\.](\d{2})(?::\d{2})?)?\s*(AM|PM)$/i);
  if (mAP) {
    let h   = parseInt(mAP[1], 10);
    const m = mAP[2] ? parseInt(mAP[2], 10) : 0;
    const p = mAP[3].toUpperCase();
    if (h < 1 || h > 12 || m > 59) return "";
    if (p === "PM" && h !== 12) h += 12;
    if (p === "AM" && h === 12) h  = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return "";
}

// ── Inline getISTSlot that accepts a fixed UTC h/m/s instead of Date.now() ───
function getISTSlotFor(utcH, utcM, utcS = 0) {
  const UTC_OFFSET_HOURS = 5.5;
  const utcMs   = (utcH * 3600 + utcM * 60 + utcS) * 1000;
  const localMs = utcMs + UTC_OFFSET_HOURS * 3600_000;
  const local   = new Date(localMs);
  const h       = local.getUTCHours();
  const m       = local.getUTCMinutes();
  const slotMin = m >= 30 ? 30 : 0;
  return `${String(h).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`;
}

// ── 1. formatTime cases ───────────────────────────────────────────────────────
console.log("── formatTime ───────────────────────────────────────────────");
const cases = [
  // All real sheet values
  "8 AM", "9 AM", "10 AM", "11 AM", "12 PM",
  "1 PM", "2 PM", "3 PM",
  "7 PM", "8 PM", "9 PM", "10 PM", "11 PM",
  "12 AM", "3 AM", "4 AM",
  "9:30 AM", "9:30 PM", "2:30PM", "10.30AM",
  // Extra variants from spec
  "9:30PM", "2.30PM", "10:30AM", "12:00:00 AM",
  // Pure 24-hour
  "21:30", "9:30",
  // Invalid / edge
  "", "abc", "25:00",
];

for (const c of cases) {
  console.log(`  ${JSON.stringify(c).padEnd(20)} → "${formatTime(c)}"`);
}

// ── 2. getISTSlot simulation ──────────────────────────────────────────────────
console.log("\n── getISTSlot (UTC input → IST slot) ───────────────────────");
const slotCases = [
  { utc: "03:30:00", args: [3,  30, 0],  expected: "09:00" },
  { utc: "03:30:40", args: [3,  30, 40], expected: "09:00" },
  { utc: "04:00:05", args: [4,  0,  5],  expected: "09:30" },
  { utc: "04:59:59", args: [4,  59, 59], expected: "10:00" },
  { utc: "18:30:00", args: [18, 30, 0],  expected: "00:00" },
];

for (const { utc, args, expected } of slotCases) {
  const got = getISTSlotFor(...args);
  const ok  = got === expected ? "✓" : `✗ (expected ${expected})`;
  console.log(`  UTC ${utc} → IST slot "${got}" ${ok}`);
}
