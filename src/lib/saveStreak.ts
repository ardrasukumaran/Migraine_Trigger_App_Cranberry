// src/lib/saveStreak.ts
import { scoreForCount } from "@/lib/supplements";

const BACKEND_URL = "https://cranberry-notifications.onrender.com";

const SUPP_NAMES: Record<string, string> = {
  "ribo":     "Ribo",
  "mg":       "Mg",
  "mg-gly":   "Mg",
  "coq":      "CoQ",
  "coq-mgox": "CoQ",
  "premence": "Premence",
  "feverfew": "Feverfew",
  "vitd":     "D3",
};

function idsToLabel(ids: string[]): string {
  return ids.map((id) => SUPP_NAMES[id] ?? id).join(" + ");
}

// Debounce timers
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

// Save single slot
export function saveStreakToSheet({
  slot, date, ids, phone,
}: {
  slot: "morning" | "evening";
  date: string;
  ids: string[];
  phone: string;
}): void {
  if (!phone) return;
  const key = `${phone}-${date}-${slot}`;
  if (timers[key]) clearTimeout(timers[key]);
  timers[key] = setTimeout(async () => {
    try {
      const supplements = idsToLabel(ids);
      const score       = ids.length;
      const type        = slot === "morning" ? "day" : "night";
      await fetch(`${BACKEND_URL}/save-streak`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, date, type, supplements, score }),
      });
      console.log(`[Streak] ✓ Saved ${type} for ${phone}: ${supplements} (${score} pts)`);
    } catch (err) {
      console.error("[Streak] Save failed:", err);
    }
    delete timers[key];
  }, 3000);
}

// Save only today's entries — historical data already in sheet
export function saveAllStreaksToSheet(
  entries: Record<string, { morning?: string[]; evening?: string[] }>,
  phone: string
): void {
  if (!phone) return;

  // Only save today — avoids race condition on initial load
  const today = new Date().toISOString().split("T")[0]; // yyyy-MM-dd
  const entry = entries[today];

  if (!entry) return;

  if (entry.morning && entry.morning.length > 0) {
    saveStreakToSheet({ slot: "morning", date: today, ids: entry.morning, phone });
  }
  if (entry.evening && entry.evening.length > 0) {
    saveStreakToSheet({ slot: "evening", date: today, ids: entry.evening, phone });
  }
}

// Save combo to Google Sheet Users columns G and H
export async function saveComboToSheet({
  phone, dayCombo, nightCombo,
}: {
  phone: string;
  dayCombo: string;
  nightCombo: string;
}): Promise<void> {
  if (!phone) return;
  try {
    await fetch(`${BACKEND_URL}/save-combo`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone, dayCombo, nightCombo }),
    });
    console.log(`[Combo] ✓ Saved combo for ${phone}: ${dayCombo} | ${nightCombo}`);
  } catch (err) {
    console.error("[Combo] Save failed:", err);
  }
}
