export type TriggerStat = {
  name: string;
  count: number;
  correlation: number;
};

export type RawAttack = {
  date: string;
  intensity: number;
  duration: string;
};

export type SheetDayAttack = {
  day: number;
  intensity: number;
  duration: string;
};

export type SheetMonthData = {
  label: string;
  year: number;
  monthIndex: number;
  days: number;
  attacks: SheetDayAttack[];
};

// ── Fetch top triggers ────────────────────────────────────────────
export async function fetchTopTriggers(phone: string): Promise<TriggerStat[]> {
  try {
    const res  = await fetch(`/api/triggers?phone=${encodeURIComponent(phone)}`);
    const data = await res.json() as { triggers?: TriggerStat[]; error?: string };
    return data.triggers ?? [];
  } catch {
    return [];
  }
}

// ── Fetch month-wise attack data ──────────────────────────────────
export async function fetchMonthData(phone: string): Promise<SheetMonthData[]> {
  try {
    const res  = await fetch(`/api/attacks?phone=${encodeURIComponent(phone)}`);
    const data = await res.json() as { attacks?: RawAttack[]; error?: string };
    return buildMonthData(data.attacks ?? []);
  } catch {
    return [];
  }
}

// ── Parse date string → { year, month (0-based), day } ───────────
function parseDate(str: string): { year: number; month: number; day: number } | null {
  // Try YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { year: +m[1], month: +m[2] - 1, day: +m[3] };
  // Try DD/MM/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { year: +m[3], month: +m[2] - 1, day: +m[1] };
  // Try DD-MM-YYYY
  m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return { year: +m[3], month: +m[2] - 1, day: +m[1] };
  return null;
}

// ── Normalise duration string to closest DurationBucket ──────────
const DURATION_MAP: [RegExp, string][] = [
  [/24/,        "24h"],
  [/>\s*6/,     ">6h"],
  [/6\s*h/i,    "6h"],
  [/3\s*[-–]\s*6/i, "3-6h"],
  [/<\s*3/,     "<3h"],
];

function normalizeDuration(raw: string): string {
  for (const [re, bucket] of DURATION_MAP) {
    if (re.test(raw)) return bucket;
  }
  return "3-6h"; // fallback
}

// ── Build MonthData array from raw attacks ────────────────────────
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function buildMonthData(attacks: RawAttack[]): SheetMonthData[] {
  if (attacks.length === 0) return [];

  // Group attacks by year-month key
  const byMonth = new Map<string, SheetDayAttack[]>();

  for (const a of attacks) {
    const parsed = parseDate(a.date);
    if (!parsed) continue;
    const { year, month, day } = parsed;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push({ day, intensity: a.intensity, duration: normalizeDuration(a.duration) });
    byMonth.set(key, list);
  }

  if (byMonth.size === 0) return [];

  // Find range: min and max month
  const sortedKeys = [...byMonth.keys()].sort();
  const parseKey = (k: string) => ({ year: +k.split("-")[0], month: +k.split("-")[1] });
  const { year: minYear, month: minMonth } = parseKey(sortedKeys[0]);
  const { year: maxYear, month: maxMonth } = parseKey(sortedKeys[sortedKeys.length - 1]);

  // Walk from latest → earliest, filling missing months
  const result: SheetMonthData[] = [];
  let y = maxYear, mo = maxMonth;

  while (y > minYear || (y === minYear && mo >= minMonth)) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    result.push({
      label:      `${MONTH_LABELS[mo]} ${y}`,
      year:       y,
      monthIndex: mo,
      days:       daysInMonth(y, mo),
      attacks:    byMonth.get(key) ?? [],
    });
    mo--;
    if (mo < 0) { mo = 11; y--; }
  }

  return result; // latest first
}
