// src/lib/saveStreak.ts
// Call this after user saves their supplement dose
// It logs the streak data to Google Sheet

import { scoreForCount, ALL_SUPPLEMENTS } from "@/lib/supplements";

const BACKEND_URL = "https://cranberry-notifications.onrender.com";

export async function saveStreakToSheet({
  slot,
  date,
  ids,
  phone,
}: {
  slot:  "morning" | "evening";
  date:  string;
  ids:   string[];
  phone: string;
}): Promise<void> {
  if (!phone || !ids.length) return;

  try {
    // Build supplement names string
    const supplements = ids
      .map((id) => ALL_SUPPLEMENTS.find((s) => s.id === id)?.short ?? id)
      .join(" + ");

    // Calculate score
    const score = scoreForCount(ids.length) * 10;

    // Map slot to type
    const type = slot === "morning" ? "day" : "night";

    await fetch(`${BACKEND_URL}/save-streak`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone, date, type, supplements, score }),
    });

    console.log(`[Streak] Saved ${type} log for ${phone}: ${supplements} (${score} pts)`);
  } catch (err) {
    // Non-fatal — don't block the UI
    console.error("[Streak] Save failed:", err);
  }
}
