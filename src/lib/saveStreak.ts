// src/lib/saveStreak.ts

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

// ─── Save single slot to sheet ────────────────────────────────────────────────
// Called directly when user saves (5 sec timer in ChecklistView handles the delay)
// No extra debounce needed here — just send immediately
export async function saveStreakToSheet({
  slot, date, ids, phone,
}: {
  slot: "morning" | "evening";
  date: string;
  ids: string[];
  phone: string;
}): Promise<void> {
  if (!phone) return;
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
}

// ─── Called from useEffect when state.entries changes ────────────────────────
// Only saves today's entry — no historical sync on load
export function saveAllStreaksToSheet(
  entries: Record<string, { morning?: string[]; evening?: string[] }>,
  phone: string
): void {
  if (!phone) return;

  const today = new Date().toISOString().split("T")[0]; // yyyy-MM-dd
  const entry = entries[today];
  if (!entry) return;

  // Save today's morning if exists
  if (entry.morning && entry.morning.length > 0) {
    saveStreakToSheet({ slot: "morning", date: today, ids: entry.morning, phone });
  }
  // Save today's evening if exists
  if (entry.evening && entry.evening.length > 0) {
    saveStreakToSheet({ slot: "evening", date: today, ids: entry.evening, phone });
  }
}

// ─── Save combo to Google Sheet ───────────────────────────────────────────────
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
