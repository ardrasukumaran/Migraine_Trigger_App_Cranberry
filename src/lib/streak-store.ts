import { useEffect, useState } from "react";
import { DAY_COMBOS, NIGHT_COMBOS } from "./supplements";

const KEY = "cranberry.streaks.v1";

export type DayEntry = {
  morning: string[];
  evening: string[];
  morningSkipped?: boolean;
  eveningSkipped?: boolean;
};

export type StreakState = {
  dayComboId: string;
  nightComboId: string;
  entries: Record<string, DayEntry>;
};

const DEFAULT_STATE: StreakState = {
  dayComboId: DAY_COMBOS[0].id,
  nightComboId: NIGHT_COMBOS[0].id,
  entries: seedHistory(),
};

function seedHistory(): Record<string, DayEntry> {
  const out: Record<string, DayEntry> = {};
  const today = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = isoDate(d);
    if (i === 4) continue;
    out[key] = {
      morning: ["ribo", "coq-mgox"],
      evening: i % 3 === 0 ? ["ribo"] : ["ribo", "mg-gly"],
    };
  }
  return out;
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayIso() {
  return isoDate(new Date());
}

function load(): StreakState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function save(s: StreakState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function useStreakState() {
  const [state, setState] = useState<StreakState>(DEFAULT_STATE);

  useEffect(() => {
    setState(load());
  }, []);

  const update = (fn: (s: StreakState) => StreakState) => {
    setState((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  };

  return [state, update] as const;
}

export function currentStreak(entries: Record<string, DayEntry>) {
  let n = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = isoDate(d);
    const e = entries[key];
    const took =
      (e?.morning?.length ?? 0) + (e?.evening?.length ?? 0) > 0;
    if (!took) {
      if (i === 0) {
        d.setDate(d.getDate() - 1);
        continue;
      }
      break;
    }
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
