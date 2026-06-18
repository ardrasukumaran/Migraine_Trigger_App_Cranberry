export type Supplement = {
  id: string;
  name: string;
  short: string;
  emoji: string;
  dose: string;
};

export const ALL_SUPPLEMENTS: Supplement[] = [
  { id: "ribo", name: "Riboflavin (B2)", short: "Ribo", emoji: "🟡", dose: "400mg" },
  { id: "mg", name: "Magnesium glycinate", short: "Mg", emoji: "🔵", dose: "400mg" },
  { id: "coq", name: "CoQ10", short: "CoQ", emoji: "🟠", dose: "150mg" },
  { id: "premence", name: "Premence", short: "Premence", emoji: "🟣", dose: "1 tab" },
  { id: "feverfew", name: "Feverfew", short: "FF", emoji: "🌿", dose: "100mg" },
  { id: "vitd", name: "Vitamin D3", short: "D3", emoji: "☀️", dose: "2000 IU" },
];

export const DAY_COMBOS: { id: string; label: string; ids: string[] }[] = [
  { id: "day-a", label: "Ribo + Mg + Premence", ids: ["ribo", "mg", "premence"] },
  { id: "day-b", label: "Ribo + Mg + CoQ", ids: ["ribo", "mg", "coq"] },
  { id: "day-c", label: "Ribo + Mg + Feverfew", ids: ["ribo", "mg", "feverfew"] },
  { id: "day-d", label: "Ribo + Mg + D3", ids: ["ribo", "mg", "vitd"] },
];

export const NIGHT_COMBOS: { id: string; label: string; ids: string[] }[] = [
  { id: "night-a", label: "Mg + CoQ", ids: ["mg", "coq"] },
  { id: "night-b", label: "Mg + Premence", ids: ["mg", "premence"] },
];

export const MILESTONES = [
  { days: 30, reward: "10% off", desc: "Your first month of consistency" },
  { days: 60, reward: "15% off", desc: "A real habit forming" },
  { days: 90, reward: "Referral coupon", desc: "Share the love with a friend" },
];

// Weight series for scoring — index maps to supplement count
const WEIGHTS = [3, 7, 14, 30];

// Score for N supplements taken: sum of first N weights (e.g. 2 → 3+7=10)
export function scoreForCount(taken: number): number {
  return WEIGHTS.slice(0, taken).reduce((a, b) => a + b, 0);
}

// Maximum possible score for a combo of given length
export function totalPossibleScore(comboLength: number): number {
  return WEIGHTS.slice(0, comboLength).reduce((a, b) => a + b, 0);
}

export const SKIP_SCORE = 1;
