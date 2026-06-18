export type Supplement = {
  id: string;
  name: string;
  short: string;
  emoji: string;
  dose: string;
};

export const ALL_SUPPLEMENTS: Supplement[] = [
  { id: "ribo",        name: "Riboflavin",                         short: "Ribo",   emoji: "🟡", dose: "200mg"        },
  { id: "mg-gly",      name: "Magnesium Glycinate",                short: "Mg Gly", emoji: "🔵", dose: "220mg"        },
  { id: "coq-mgox",    name: "Magnesium Oxide + CoQ10",            short: "CoQ+Mg", emoji: "🟠", dose: "340mg + 150mg" },
  { id: "coq",         name: "CoQ10",                              short: "CoQ",    emoji: "🟠", dose: "100mg"        },
  { id: "vit-b6",      name: "Vitamin B6 + Essential Nutrients",   short: "Vit B6", emoji: "💛", dose: "40mg"         },
  { id: "myo",         name: "Myo-inositol + Essential Nutrients", short: "Myo",    emoji: "🌿", dose: "550mg"        },
  { id: "isoflavones", name: "Isoflavones + Essential Nutrients",  short: "Iso",    emoji: "🌸", dose: "100mg"        },
];

export const DAY_COMBOS: { id: string; label: string; ids: string[] }[] = [
  { id: "day-a", label: "Ribo + CoQ & Mg Oxide",           ids: ["ribo", "coq-mgox"]     },
  { id: "day-b", label: "Ribo + Vit B6 & Nutrients",       ids: ["ribo", "vit-b6"]       },
  { id: "day-c", label: "Ribo + Myo-inositol & Nutrients", ids: ["ribo", "myo"]          },
  { id: "day-d", label: "Ribo + Isoflavones & Nutrients",  ids: ["ribo", "isoflavones"]  },
];

export const NIGHT_COMBOS: { id: string; label: string; ids: string[] }[] = [
  { id: "night-a", label: "Ribo + Mg Gly",       ids: ["ribo", "mg-gly"]        },
  { id: "night-b", label: "Ribo + Mg Gly + CoQ", ids: ["ribo", "mg-gly", "coq"] },
];

export const MILESTONES = [
  { days: 30, reward: "10% off", desc: "Your first month of consistency" },
  { days: 60, reward: "15% off", desc: "A real habit forming" },
  { days: 90, reward: "Referral coupon", desc: "Share the love with a friend" },
];

// Weight series for scoring — index maps to supplement count
const WEIGHTS = [2, 4, 8, 16];

// Score for N supplements taken: sum of first N weights (e.g. 2 → 3+7=10)
export function scoreForCount(taken: number): number {
  return WEIGHTS.slice(0, taken).reduce((a, b) => a + b, 0);
}

// Maximum possible score for a combo of given length
export function totalPossibleScore(comboLength: number): number {
  return WEIGHTS.slice(0, comboLength).reduce((a, b) => a + b, 0);
}

export const SKIP_SCORE = 1;
