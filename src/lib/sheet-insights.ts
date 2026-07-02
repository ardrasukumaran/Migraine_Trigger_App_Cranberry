import { getAttacks } from "./storage";

export type TriggerStat = {
  name: string;
  count: number;
  correlation: number;
};

export type RawAttack = {
  date: string;
  intensity: number;
  duration: string;
  triggers: string[];
};

export type SheetAttack = {
  date: string;        // raw date string (ISO or DD/MM/YYYY)
  displayDate: string; // formatted e.g. "8 Jun 2026"
  intensity: number;
  duration: string;
  triggers: string[];
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

// ── Date helpers ──────────────────────────────────────────────────
const DISPLAY_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseDate(str: string): { year: number; month: number; day: number } | null {
  // YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { year: +m[1], month: +m[2] - 1, day: +m[3] };
  // DD/MM/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { year: +m[3], month: +m[2] - 1, day: +m[1] };
  // DD-MM-YYYY
  m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return { year: +m[3], month: +m[2] - 1, day: +m[1] };
  return null;
}

function formatDisplayDate(raw: string): string {
  const parsed = parseDate(raw);
  if (!parsed) return raw;
  return `${parsed.day} ${DISPLAY_MONTHS[parsed.month]} ${parsed.year}`;
}

// ── Duration normaliser ───────────────────────────────────────────
const DURATION_MAP: [RegExp, string][] = [
  [/24/,             "24h"],
  [/>\s*6/,          ">6h"],
  [/6\s*h/i,         "6h"],
  [/3\s*[-–]\s*6/i,  "3-6h"],
  [/<\s*3/,          "<3h"],
];

function normalizeDuration(raw: string): string {
  for (const [re, bucket] of DURATION_MAP) {
    if (re.test(raw)) return bucket;
  }
  return "3-6h";
}

// ── Cache-first: load all attacks ─────────────────────────────────
// Returns localStorage attacks if non-empty; otherwise fetches from sheet.
export async function loadAttacks(phone: string): Promise<SheetAttack[]> {
  const cached = getAttacks();

  if (cached.length > 0) {
    return cached
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(a => ({
        date:        a.date,
        displayDate: formatDisplayDate(a.date),
        intensity:   a.intensity,
        duration:    normalizeDuration(a.duration),
        triggers:    [...(a.foods ?? []), ...(a.nonFoodTriggers ?? [])],
      }));
  }

  // Cache empty → fetch from Google Sheet
  try {
    const res  = await fetch(`/api/attacks?phone=${encodeURIComponent(phone)}`);
    const data = await res.json() as { attacks?: RawAttack[] };
    return (data.attacks ?? []).map(a => ({
      date:        a.date,
      displayDate: formatDisplayDate(a.date),
      intensity:   a.intensity,
      duration:    normalizeDuration(a.duration),
      triggers:    a.triggers,
    }));
  } catch {
    return [];
  }
}

// ── Cache-first: top triggers ─────────────────────────────────────
export async function fetchTopTriggers(phone: string): Promise<TriggerStat[]> {
  const cached = getAttacks();

  if (cached.length > 0) {
    const counts: Record<string, number> = {};
    for (const a of cached) {
      for (const t of [...(a.foods ?? []), ...(a.nonFoodTriggers ?? [])]) {
        if (t) counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    const total = cached.length;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        correlation: Math.round((count / total) * 100),
      }));
  }

  // Cache empty → fetch from sheet API
  try {
    const res  = await fetch(`/api/triggers?phone=${encodeURIComponent(phone)}`);
    const data = await res.json() as { triggers?: TriggerStat[] };
    return data.triggers ?? [];
  } catch {
    return [];
  }
}

// ── Build MonthData from SheetAttack[] ────────────────────────────
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function buildMonthData(attacks: SheetAttack[]): SheetMonthData[] {
  if (attacks.length === 0) return [];

  const byMonth = new Map<string, SheetDayAttack[]>();

  for (const a of attacks) {
    const parsed = parseDate(a.date);
    if (!parsed) continue;
    const { year, month, day } = parsed;
    const key  = `${year}-${String(month).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push({ day, intensity: a.intensity, duration: a.duration });
    byMonth.set(key, list);
  }

  if (byMonth.size === 0) return [];

  const sortedKeys = [...byMonth.keys()].sort();
  const parseKey   = (k: string) => ({ year: +k.split("-")[0], month: +k.split("-")[1] });
  const { year: minYear, month: minMonth } = parseKey(sortedKeys[0]);
  const { year: maxYear, month: maxMonth } = parseKey(sortedKeys[sortedKeys.length - 1]);

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
