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

export function phaseForDay(dayInCycle: number, days: number, periodDays = 5): PhaseKey {
  if (dayInCycle <= periodDays) return "period";
  if (dayInCycle <= 14) return "follicular";
  if (dayInCycle > days - 5) return "pms";
  return "luteal";
}

// ── Storage ────────────────────────────────────────────────────────
export const PERIOD_STORAGE_KEY = "cranberry_periods_v1";

export type PeriodLog = {
  id: string;
  startDate: string; // YYYY-MM-DD
};

export type PeriodState = {
  logs: PeriodLog[];   // newest first
  cycleLength: number; // default 28
  periodDays: number;  // default 5
};

const DEFAULT_STATE: PeriodState = { logs: [], cycleLength: 28, periodDays: 5 };

export function getPeriodState(): PeriodState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
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

// Recalculate average cycle length from the last 3 logged periods
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
      // Current cycle: from last period start to today
      days = dayInCurrentCycle(log.startDate);
      endDate = todayStr;
      ongoing = true;
    } else if (next) {
      // Cycle = gap between this period start and the next one
      const start = new Date(log.startDate + "T00:00:00");
      const end = new Date(next.startDate + "T00:00:00");
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
      ongoing,
    };
  });
}
