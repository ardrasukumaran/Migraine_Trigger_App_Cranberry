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

// Score formula: 2^position
// 1st supplement → 2, 2nd → 4, 3rd → 8, Skipped → 1
// Total = sum of all taken
function scoreForPosition(position: number): number {
  return Math.pow(2, position);
}

// ─── Save streak — one row per supplement ─────────────────────────────────────
export async function saveStreakToSheet({
  slot, date, ids, phone, skipped = false,
}: {
  slot: "morning" | "evening";
  date: string;
  ids: string[];
  phone: string;
  skipped?: boolean;
}): Promise<void> {
  if (!phone) return;

  const type = slot === "morning" ? "day" : "night";

  try {
    if (skipped || ids.length === 0) {
      // Save one row for skipped with score 1
      await fetch(`${BACKEND_URL}/save-streak`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, date, type, supplements: "Skipped", score: 1 }),
      });
      console.log(`[Streak] ✓ Saved skipped for ${phone} on ${date} (${type})`);
      return;
    }

    // Save one row per supplement with 2^position score
    for (let i = 0; i < ids.length; i++) {
      const suppName = SUPP_NAMES[ids[i]] ?? ids[i];
      const score    = Math.pow(2, i + 1); // 2, 4, 8, 16...

      await fetch(`${BACKEND_URL}/save-streak`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone, date, type, supplements: suppName, score }),
      });
    }
    console.log(`[Streak] ✓ Saved ${ids.length} supplements for ${phone} on ${date} (${type})`);
  } catch (err) {
    console.error("[Streak] Save failed:", err);
  }
}

// ─── Hydrate streak entries from sheet (used when localStorage cache is empty) ─
export async function hydrateStreakFromSheet(phone: string): Promise<Record<string, { morning: string[]; evening: string[] }> | null> {
  if (!phone) return null;
  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const res = await fetch(`${BACKEND_URL}/streak-history?phone=${encodeURIComponent(digits)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok || !Array.isArray(data.rows)) return null;

    const entries: Record<string, { morning: string[]; evening: string[] }> = {};
    for (const row of data.rows as { date: string; type: string; supplement: string }[]) {
      const { date, type, supplement } = row;
      if (!date) continue;
      if (!entries[date]) entries[date] = { morning: [], evening: [] };
      if (type === "day") entries[date].morning.push(supplement || "logged");
      else if (type === "night") entries[date].evening.push(supplement || "logged");
    }
    return Object.keys(entries).length > 0 ? entries : null;
  } catch {
    return null;
  }
}

// ─── saveAllStreaksToSheet — not used anymore but kept for compatibility ───────
export function saveAllStreaksToSheet(
  entries: Record<string, { morning?: string[]; evening?: string[] }>,
  phone: string
): void {
  // No-op — saving is now done directly in onSave handlers
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
