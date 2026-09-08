import { useEffect, useRef, useState } from "react";
import { DAY_COMBOS, NIGHT_COMBOS } from "./supplements";
import { hydrateStreakFromSheet } from "./saveStreak";

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
  comboLocked?: boolean;
  entries: Record<string, DayEntry>;
};

const DEFAULT_STATE: StreakState = {
  dayComboId: DAY_COMBOS[0].id,
  nightComboId: NIGHT_COMBOS[0].id,
  entries: {},
};

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

export function useStreakState(phone?: string) {
  const [state, setState] = useState<StreakState>(DEFAULT_STATE);
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = load();
    setState(stored);

    // When cache is empty and a phone is provided, pull history from the sheet
    if (phone && Object.keys(stored.entries).length === 0 && !hydratedRef.current) {
      hydratedRef.current = true;
      hydrateStreakFromSheet(phone).then((entries) => {
        if (!entries) return;
        setState((prev) => {
          const next = { ...prev, entries };
          save(next);
          return next;
        });
      });
    }
  }, [phone]);

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
