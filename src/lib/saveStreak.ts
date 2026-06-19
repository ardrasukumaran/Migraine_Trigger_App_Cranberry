// src/lib/saveStreak.ts
// Saves streak data to Google Sheet via backend
// Uses debounce — waits 3 seconds after last change before saving

import { scoreForCount, ALL_SUPPLEMENTS } from "@/lib/supplements";

const BACKEND_URL = "https://cranberry-notifications.onrender.com";

// ─── Debounce timer ───────────────────────────────────────────────────────────
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

  // Debounce key: unique per phone + date + slot
  const key = `${phone}-${date}-${slot}`;

  // Clear existing timer
  if (timers[key]) clearTimeout(timers[key]);

  // Set new timer — save after 3 seconds of no changes
  timers[key] = setTimeout(async () => {
    try {
      const supplements = ids
        .map((id) => ALL_SUPPLEMENTS.find((s) => s.id === id)?.short ?? id)
        .join(" + ");

      const score = scoreForCount(ids.length) * 10;
      const type  = slot === "morning" ? "day" : "night";

      await fetch(`${BACKEND_URL}/save-streak`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, date, type, supplements, score }),
      });

      console.log(`[Streak] Saved ${type} for ${phone} on ${date}: ${supplements} (${score} pts)`);
    } catch (err) {
      console.error("[Streak] Save failed:", err);
    }

    delete timers[key];
  }, 3000); // 3 second debounce
}

// ─── Save all entries (used when app loads or state changes) ──────────────────
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
