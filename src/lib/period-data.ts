import { useState, useCallback } from "react";
import { addDays } from "date-fns";

// ── Phase palette ──────────────────────────────────────────────────
export const PHASE = {
  period:     { name: "Period",     color: "#F2B8BF" },
  follicular: { name: "Follicular", color: "#B8E4C2" },
  luteal:     { name: "Luteal",     color: "#B8C5E8" },
  pms:        { name: "PMS",        color: "#FFCBA4" },
} as const;

export type PhaseKey = keyof typeof PHASE;
export type Mode = "regular" | "irregular";

export function phaseForDay(
  dayInCycle: number,
  cycleDays: number,
  periodLength = 5,
  pmsLength = 5,
): PhaseKey {
  if (dayInCycle <= periodLength) return "period";
  if (dayInCycle <= 14) return "follicular";
  if (dayInCycle > cycleDays - pmsLength) return "pms";
  return "luteal";
}

// ── Storage ────────────────────────────────────────────────────────
export const PERIOD_STORAGE_KEY = "cranberry_periods_v1";

export type PeriodLog = {
  id: string;
  startDate: string; // YYYY-MM-DD
  cycleId: number;   // 1 = earliest tracked, n = latest; re-assigned chronologically on every add
};

export type PeriodState = {
  logs: PeriodLog[];                      // stored newest-first

  mode: Mode;                             // from sheet baseline

  // ── Fixed baseline values (from sheet — never mutated by user actions) ──
  periodLength: number;                   // how many days the period lasts
  baselineCycleLength: number;            // cycle length as recorded in the sheet
  baselinePrevPeriodDate: string | null;  // last period before app tracking (YYYY-MM-DD)
  pmsLength: number;                      // PMS phase duration (fixed at 5)

  // ── Irregular-mode range ──
  shortestCycle: number;
  longestCycle: number;

  // ── Display counter ──
  // Equals logs.length after any add; 0 when no periods tracked.
  cycleId: number;

  // ── Computed prediction anchor (updated when periods are added) ──
  cycleLength: number;

  baselineLoaded: boolean;
};

const DEFAULT_STATE: PeriodState = {
  logs: [],
  mode: "regular",
  periodLength: 5,
  baselineCycleLength: 28,
  baselinePrevPeriodDate: null,
  pmsLength: 5,
  shortestCycle: 28,
  longestCycle: 28,
  cycleId: 0,
  cycleLength: 28,
  baselineLoaded: false,
};

export function getPeriodState(): PeriodState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // Migration: old storage used `periodDays`; map to `periodLength`
    if ("periodDays" in parsed && !("periodLength" in parsed)) {
      parsed.periodLength = parsed.periodDays;
    }
    // Migration: old logs had no cycleId field — add it
    if (Array.isArray(parsed.logs)) {
      const hasIds = (parsed.logs as PeriodLog[]).every((l) => typeof l.cycleId === "number");
      if (!hasIds) {
        parsed.logs = assignCycleIds(parsed.logs as Omit<PeriodLog, "cycleId">[]);
      }
    }
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePeriodState(state: PeriodState): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(state));
  }
}

export function usePeriodState() {
  const [state, setState] = useState<PeriodState>(getPeriodState);
  const update = useCallback((updater: (s: PeriodState) => PeriodState) => {
    setState((prev) => {
      const next = updater(prev);
      savePeriodState(next);
      return next;
    });
  }, []);
  return [state, update] as const;
}

// ── Cycle ID assignment ────────────────────────────────────────────
// Sorts logs by startDate ascending and assigns cycleId = 1, 2, 3 ...
// Returns newest-first for storage (matches existing convention).
export function assignCycleIds(
  logs: Array<Omit<PeriodLog, "cycleId"> | PeriodLog>,
): PeriodLog[] {
  const ascending = [...logs].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const withIds: PeriodLog[] = ascending.map((log, i) => ({ ...log, cycleId: i + 1 } as PeriodLog));
  // Return newest-first to match storage convention
  return withIds.reverse();
}

// Fetch baseline from server and merge into state (call once when baselineLoaded is false)
export async function loadPeriodBaseline(phone: string): Promise<Partial<PeriodState> | null> {
  try {
    const res  = await fetch(`/api/period-baseline?phone=${encodeURIComponent(phone)}`);
    const data = await res.json() as {
      found?: boolean;
      mode?: string;
      periodLength?: number;
      cycleLength?: number;
      shortestCycle?: number;
      longestCycle?: number;
      baselinePrevPeriodDate?: string | null;
      error?: string;
    };
    if (!data.found) return null;
    const mode: Mode = data.mode === "irregular" ? "irregular" : "regular";
    const periodLength   = data.periodLength   ?? 5;
    const cycleLength    = data.cycleLength    ?? 28;
    const shortestCycle  = data.shortestCycle  ?? cycleLength;
    const longestCycle   = data.longestCycle   ?? cycleLength;
    const baselinePrevPeriodDate = data.baselinePrevPeriodDate ?? null;
    return {
      mode,
      periodLength,
      baselineCycleLength: cycleLength,
      baselinePrevPeriodDate,
      cycleLength,
      shortestCycle,
      longestCycle,
      pmsLength: 5, // fixed — not from sheet
      baselineLoaded: true,
    };
  } catch {
    return null;
  }
}

// ── Derived helpers ────────────────────────────────────────────────
export function nextPeriodDate(lastStart: string, cycleLength: number): Date {
  return addDays(new Date(lastStart + "T00:00:00"), cycleLength);
}

export function daysUntilNext(lastStart: string, cycleLength: number): number {
  const next = nextPeriodDate(lastStart, cycleLength);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((next.getTime() - today.getTime()) / 86400000));
}

export function dayInCurrentCycle(lastStart: string): number {
  const start = new Date(lastStart + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000) + 1);
}

export function computeAvgCycleLength(logs: PeriodLog[]): number {
  if (logs.length < 2) return 28;
  const sorted = [...logs].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const gaps: number[] = [];
  for (let i = 0; i < Math.min(sorted.length - 1, 3); i++) {
    const a = new Date(sorted[i].startDate + "T00:00:00");
    const b = new Date(sorted[i + 1].startDate + "T00:00:00");
    gaps.push(Math.round((b.getTime() - a.getTime()) / -86400000));
  }
  return Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length);
}

export type CycleRecord = {
  label: string;
  days: number;
  startDate: string;
  endDate: string;
  cycleId: number;
  ongoing?: boolean;
};

export function buildCycleHistory(logs: PeriodLog[], cycleLength: number): CycleRecord[] {
  if (logs.length === 0) return [];
  const sorted = [...logs].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  return sorted.map((log, i) => {
    const isFirst = i === 0;
    const next = sorted[i - 1];
    let days: number;
    let endDate: string;
    let ongoing = false;

    if (isFirst) {
      days = dayInCurrentCycle(log.startDate);
      endDate = todayStr;
      ongoing = true;
    } else if (next) {
      const start = new Date(log.startDate + "T00:00:00");
      const end   = new Date(next.startDate + "T00:00:00");
      days = Math.round((end.getTime() - start.getTime()) / 86400000);
      endDate = next.startDate;
    } else {
      days = cycleLength;
      endDate = addDays(new Date(log.startDate + "T00:00:00"), cycleLength)
        .toISOString().slice(0, 10);
    }

    return {
      label: ongoing ? "Current cycle" : `${days} days`,
      days,
      startDate: log.startDate,
      endDate,
      cycleId: log.cycleId,
      ongoing,
    };
  });
}
