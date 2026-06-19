// src/lib/saveStreak.ts
// Saves streak data to Google Sheet via backend
// Uses 3 second debounce — waits after last change before saving

import { scoreForCount } from "@/lib/supplements";

const BACKEND_URL = "https://cranberry-notifications.onrender.com";

// ─── Supplement ID → readable name ───────────────────────────────────────────
// Maps all known supplement IDs to display names
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
  return ids
    .map((id) => SUPP_NAMES[id] ?? id) // fallback to raw id if not found
    .join(" + ");
}

// ─── Debounce timers ──────────────────────────────────────────────────────────
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

// ─── Save single slot ─────────────────────────────────────────────────────────
export function saveStreakToSheet({
  slot,
  date,
  ids,
  phone,
}: {
  slot:  "morning" | "evening";
  date:  string;
  ids:   string[];
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

      console.log(`[Streak] ✓ Saved ${type} for ${phone} on ${date}: ${supplements} (${score} pts)`);
    } catch (err) {
      console.error("[Streak] Save failed:", err);
    }
    delete timers[key];
  }, 3000);
}

// ─── Save all entries ─────────────────────────────────────────────────────────
export function saveAllStreaksToSheet(
  entries: Record<string, { morning?: string[]; evening?: string[] }>,
  phone: string
): void {
  if (!phone) return;

  Object.entries(entries).forEach(([date, entry]) => {
    if (entry.morning && entry.morning.length > 0) {
      saveStreakToSheet({ slot: "morning", date, ids: entry.morning, phone });
    }
    if (entry.evening && entry.evening.length > 0) {
      saveStreakToSheet({ slot: "evening", date, ids: entry.evening, phone });
    }
  });
}
