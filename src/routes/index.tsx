import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Berry } from "@/components/Berry";
import { StreakPlant } from "@/components/StreakPlant";
import { Pencil, Sun, Moon, ChevronRight, Check } from "lucide-react";
import { RECENT_ATTACKS } from "@/lib/mock-data";
import { isoDate, todayIso, useStreakState, type DayEntry } from "@/lib/streak-store";
import { ALL_SUPPLEMENTS, DAY_COMBOS, NIGHT_COMBOS } from "@/lib/supplements";
import { useAuth } from "@/context/AuthContext";
import { useRef } from "react";
import { saveStreakToSheet } from "@/lib/saveStreak";

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

      {/* Recent attacks */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
            Recent attacks
          </p>
          <Link to="/insights" className="text-xs font-semibold text-primary">See all</Link>
        </div>
        <div className="space-y-3">
          {RECENT_ATTACKS.slice(0, 3).map((a) => (
            <div
              key={a.date}
              className="rounded-2xl bg-card border border-border p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">{a.date}</p>
                <p className="text-xs text-warm-grey/80 truncate mt-1">
                  {a.duration} · {a.triggers.join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div
                  className="h-10 w-10 rounded-full grid place-items-center text-sm font-bold text-[var(--brand-ink)]"
                  style={{ backgroundColor: `var(--pain-${Math.min(10, Math.max(1, a.intensity))})` }}
                >
                  {a.intensity}
                </div>
                <Link
                  to="/log"
                  aria-label={`Log new attack`}
                  className="h-10 w-10 rounded-full grid place-items-center bg-muted text-foreground hover:bg-accent transition"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
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
            done ? "text-[var(--streak)]" : "text-warm-grey/70"
          }`}
        >
          {taken.length}/{comboIds.length}
          <ChevronRight className="h-3 w-3" />
        </span>
      </div>

      <ul className="mt-2 space-y-1">
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
                    on
                      ? "bg-[var(--streak)] border-[var(--streak)] text-[var(--streak-foreground)]"
                      : "bg-background border-warm-grey/40"
                  }`}
                  aria-hidden
                >
                  {on && <Check className="h-3 w-3" strokeWidth={4} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-semibold leading-tight ${on ? "text-[var(--streak)]" : ""}`}>
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
