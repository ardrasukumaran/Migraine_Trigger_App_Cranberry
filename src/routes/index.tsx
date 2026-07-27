import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Berry } from "@/components/Berry";
import { StreakPlant } from "@/components/StreakPlant";
import { Sun, Moon, ChevronRight, Check, Droplet, Plus } from "lucide-react";
import { isoDate, todayIso, useStreakState, type DayEntry } from "@/lib/streak-store";
import { ALL_SUPPLEMENTS, DAY_COMBOS, NIGHT_COMBOS } from "@/lib/supplements";
import { useAuth } from "@/context/AuthContext";
import { useRef, useState } from "react";
import { saveStreakToSheet } from "@/lib/saveStreak";
import { getAttacks, formatAttackDate, type AttackLog } from "@/lib/storage";
import { getPeriodState, daysUntilNext, nextPeriodDate, computeAvgCycleLength } from "@/lib/period-data";
import { format } from "date-fns";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Migraine tracker" },
      { name: "description", content: "Daily check-in and gentle insights for your migraine journey." },
    ],
  }),
  component: TodayPage,
});

function slotStreak(
  entries: Record<string, DayEntry>,
  slot: "morning" | "evening",
) {
  return Object.values(entries).filter((e) => (e?.[slot]?.length ?? 0) > 0).length;
}

function TodayPage() {
  const { userName, phone } = useAuth();
  const [state, update] = useStreakState();
  const [attacks] = useState<AttackLog[]>(() =>
    getAttacks().sort((a, b) => b.createdAt - a.createdAt)
  );
  const periodState = getPeriodState();
  const periodSorted = [...periodState.logs].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastPeriodLog = periodSorted[0] ?? null;
  const isIrregularCycle = periodState.mode === "irregular";
  const avgCycle = periodState.logs.length >= 2
    ? computeAvgCycleLength(periodState.logs)
    : periodState.cycleLength;
  // Regular
  const periodDaysLeft = lastPeriodLog ? daysUntilNext(lastPeriodLog.startDate, avgCycle) : null;
  const predictedNext  = lastPeriodLog ? nextPeriodDate(lastPeriodLog.startDate, avgCycle) : null;
  // Irregular window
  const irrLow       = lastPeriodLog ? daysUntilNext(lastPeriodLog.startDate, periodState.shortestCycle) : null;
  const irrHigh      = lastPeriodLog ? daysUntilNext(lastPeriodLog.startDate, periodState.longestCycle)  : null;
  const irrNextShort = lastPeriodLog ? nextPeriodDate(lastPeriodLog.startDate, periodState.shortestCycle) : null;
  const irrNextLong  = lastPeriodLog ? nextPeriodDate(lastPeriodLog.startDate, periodState.longestCycle)  : null;

  const dayStreak = slotStreak(state.entries, "morning");
  const nightStreak = slotStreak(state.entries, "evening");
  const today = state.entries[todayIso()];
  const dayCombo = DAY_COMBOS.find((c) => c.id === state.dayComboId)!;
  const nightCombo = NIGHT_COMBOS.find((c) => c.id === state.nightComboId)!;
  const morningTaken = today?.morning ?? [];
  const eveningTaken = today?.evening ?? [];
  const morningDone = morningTaken.length >= dayCombo.ids.length;
  const eveningDone = eveningTaken.length >= nightCombo.ids.length;
  const morningSkipped = !!today?.morningSkipped;
  const eveningSkipped = !!today?.eveningSkipped;

  const toggleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const toggle = (slot: "morning" | "evening", id: string) => {
    update((s) => {
      const key = todayIso();
      const entry = s.entries[key] ?? { morning: [], evening: [] };
      const current = entry[slot] ?? [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      const newEntries = { ...s, entries: { ...s.entries, [key]: { ...entry, [slot]: next } } };

      const timerKey = `${slot}`;
      if (toggleTimers.current[timerKey]) clearTimeout(toggleTimers.current[timerKey]);
      toggleTimers.current[timerKey] = setTimeout(() => {
        if (phone && next.length > 0) {
          saveStreakToSheet({ slot, date: key, ids: next, phone });
        }
        delete toggleTimers.current[timerKey];
      }, 5000);

      return newEntries;
    });
  };

  return (
    <AppShell
      subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      title={<>Hello{userName ? ` ${userName}` : ""},</>}
      right={<Berry mood="wave" size={68} className="-mt-2 -mr-1" />}
    >
      {/* Streak cards — Day & Night side-by-side */}
      <section className="mt-8 grid grid-cols-2 gap-3">
        <StreakCard label="Day" icon={<Sun className="h-3.5 w-3.5" />} days={dayStreak} />
        <StreakCard label="Night" icon={<Moon className="h-3.5 w-3.5" />} days={nightStreak} />
      </section>

      {/* Plan lists */}
      <section className="mt-8">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-3">
          Today's plan
        </p>
        <div className="grid grid-cols-2 gap-3">
          <PlanList
            icon={<Sun className="h-4 w-4" />}
            label="Day"
            slot="morning"
            comboIds={dayCombo.ids}
            taken={morningTaken}
            done={morningDone}
            skipped={morningSkipped}
            onToggle={(id) => toggle("morning", id)}
          />
          <PlanList
            icon={<Moon className="h-4 w-4" />}
            label="Night"
            slot="evening"
            comboIds={nightCombo.ids}
            taken={eveningTaken}
            done={eveningDone}
            skipped={eveningSkipped}
            onToggle={(id) => toggle("evening", id)}
          />
        </div>
      </section>

      {/* Cycle card */}
      <section className="mt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-3">
          Cycle
        </p>
        <Link
          to="/period"
          className="relative block rounded-3xl border border-[#F2B8BF]/30 bg-gradient-to-br from-[#2A1520] via-[#1F1220] to-[#1A0F1E] px-5 py-5 active:scale-[0.99] transition overflow-hidden"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[#F2B8BF]/80">
                {lastPeriodLog ? "Next Period In" : "Track your cycle"}
              </p>
              {lastPeriodLog ? (
                isIrregularCycle ? (
                  /* Irregular: show range */
                  <>
                    <p className="mt-1 text-4xl font-bold text-foreground leading-none">
                      <span className="text-[#F2B8BF]">{irrLow}</span>
                      <span className="text-2xl text-foreground/50">–</span>
                      <span className="text-[#F2B8BF]">{irrHigh}</span>{" "}
                      <span className="text-2xl font-bold text-foreground/90">days</span>
                    </p>
                    {irrNextShort && irrNextLong && (
                      <p className="mt-2 text-[11px] text-[#F2B8BF]/80">
                        {format(irrNextShort, "d MMM")} – {format(irrNextLong, "d MMM")}
                      </p>
                    )}
                  </>
                ) : (
                  /* Regular: single value */
                  <>
                    <p className="mt-1 text-4xl font-bold text-foreground leading-none">
                      <span className="text-[#F2B8BF]">{periodDaysLeft}</span>{" "}
                      <span className="text-2xl font-bold text-foreground/90">days</span>
                    </p>
                    {predictedNext && (
                      <p className="mt-2 text-[11px] text-[#F2B8BF]/80">
                        Expected {format(predictedNext, "EEE, d MMM")}
                      </p>
                    )}
                  </>
                )
              ) : (
                <p className="mt-2 text-sm text-[#F2B8BF]/70">
                  Log your first period to get predictions
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span className="relative h-14 w-14 rounded-full grid place-items-center bg-gradient-to-br from-[#FF6B7A] to-[#E94560] shadow-lg shadow-[#E94560]/30">
                <Droplet className="h-6 w-6 text-white" fill="currentColor" strokeWidth={0} />
                <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white grid place-items-center border-2 border-[#1A0F1E]">
                  <Plus className="h-3 w-3 text-[#E94560]" strokeWidth={3} />
                </span>
              </span>
              <span className="text-[11px] font-semibold text-foreground/90">Log Period</span>
            </div>
          </div>
        </Link>
      </section>

      {/* Recent attacks */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
            Recent attacks
          </p>
          <Link to="/insights" className="text-xs font-semibold text-primary">See all</Link>
        </div>
        {attacks.length === 0 ? (
          <p className="text-xs text-warm-grey/60 py-3">No attacks logged yet.</p>
        ) : (
          <div className="space-y-3">
            {attacks.slice(0, 3).map((a) => {
              const triggers = [...a.foods, ...a.nonFoodTriggers];
              return (
                <div
                  key={a.id}
                  className="rounded-2xl bg-card border border-border p-5 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatAttackDate(a.date)}</p>
                    <p className="text-xs text-warm-grey/80 truncate mt-1">
                      {a.duration}{triggers.length > 0 ? ` · ${triggers.slice(0, 2).join(", ")}` : ""}
                    </p>
                  </div>
                  <div
                    className="h-10 w-10 rounded-full grid place-items-center text-sm font-bold text-[var(--brand-ink)] shrink-0"
                    style={{ backgroundColor: `var(--pain-${Math.min(10, Math.max(1, a.intensity))})` }}
                  >
                    {a.intensity}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function StreakCard({
  label,
  icon,
  days,
}: {
  label: string;
  icon: React.ReactNode;
  days: number;
}) {
  return (
    <Link
      to="/coach"
      className="block rounded-3xl bg-card border border-border p-4 active:scale-[0.99] transition"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] font-semibold text-warm-grey/80">
          {icon}
          {label}
        </span>
        <ChevronRight className="h-4 w-4 text-warm-grey/50" />
      </div>
      <div className="mt-1 grid place-items-center">
        <StreakPlant days={days} size={84} />
      </div>
      <p className="mt-1 text-center text-xl font-bold leading-none">
        {days} <span className="text-sm font-medium text-warm-grey/80">
          {days === 1 ? "day" : "days"}
        </span> <span aria-hidden>🔥</span>
      </p>
    </Link>
  );
}

function PlanList({
  icon,
  label,
  slot,
  comboIds,
  taken,
  done,
  skipped,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  slot: "morning" | "evening";
  comboIds: string[];
  taken: string[];
  done: boolean;
  skipped: boolean;
  onToggle: (id: string) => void;
}) {
  const locked = done || skipped;
  const cls = `block rounded-2xl border p-3 transition ${
    done
      ? "bg-[var(--streak-soft)] border-[var(--streak)]/40"
      : "bg-card border-border"
  } ${!locked ? "active:scale-[0.99]" : ""}`;

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          {icon}
          {label}
        </span>
        <span
          className={`text-[11px] tabular-nums flex items-center gap-1 ${
            done ? "text-[var(--streak)]" : skipped ? "text-warm-grey/50" : "text-warm-grey/70"
          }`}
        >
          {skipped ? "Skipped" : `${taken.length}/${comboIds.length}`}
          {!skipped && <ChevronRight className="h-3 w-3" />}
        </span>
      </div>

      <ul className={`mt-2 space-y-1 ${skipped ? "opacity-40" : ""}`}>
        {comboIds.map((id) => {
          const sup = ALL_SUPPLEMENTS.find((s) => s.id === id);
          const on = taken.includes(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={(e) => {
                  if (locked) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onToggle(id);
                }}
                disabled={locked}
                aria-pressed={on}
                className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-2 border transition text-left ${
                  on
                    ? "bg-[var(--streak-soft)] border-[var(--streak)]/40"
                    : "bg-background border-border"
                } ${!locked ? "active:scale-[0.99] hover:bg-muted/60" : "cursor-default"}`}
              >
                <span
                  className={`h-5 w-5 shrink-0 rounded-full grid place-items-center border-2 transition ${
                    on && !locked
                      ? "bg-[var(--streak)] border-[var(--streak)] text-[var(--streak-foreground)]"
                      : on && locked
                      ? "bg-warm-grey/30 border-warm-grey/30 text-background"
                      : "bg-background border-warm-grey/40"
                  }`}
                  aria-hidden
                >
                  {on && <Check className="h-3 w-3" strokeWidth={4} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold leading-tight ${on && !locked ? "text-[var(--streak)]" : on && locked ? "text-warm-grey/50" : ""}`}>
                    {sup?.name ?? id}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );

  if (locked) {
    return <div className={cls}>{inner}</div>;
  }

  return (
    <Link to="/coach" search={{ view: slot }} className={cls}>
      {inner}
    </Link>
  );
}
