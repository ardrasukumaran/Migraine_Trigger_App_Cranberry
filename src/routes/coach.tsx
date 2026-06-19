import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StreakPlant } from "@/components/StreakPlant";
import {
  ALL_SUPPLEMENTS,
  DAY_COMBOS,
  NIGHT_COMBOS,
  MILESTONES,
  scoreForCount,
} from "@/lib/supplements";
import {
  currentStreak,
  isoDate,
  todayIso,
  useStreakState,
  type DayEntry,
} from "@/lib/streak-store";
import {
  Utensils,
  UtensilsCrossed,
  Check,
  ChevronLeft,
  ChevronRight,
  Bell,
  Gift,
  Settings2,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveStreakToSheet } from "@/lib/saveStreak";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "Streaks — Supplement habit" },
      { name: "description", content: "Track your daily supplements and grow your streak." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { view?: View } => {
    const v = search.view;
    const allowed: View[] = ["home", "morning", "evening", "back-fill", "milestones", "setup", "lock"];
    return { view: allowed.includes(v as View) ? (v as View) : undefined };
  },
  component: StreaksPage,
});

type View = "home" | "morning" | "evening" | "back-fill" | "milestones" | "setup" | "lock";

function StreaksPage() {
  const { view: searchView } = Route.useSearch();
  const { phone } = useAuth();
  const [state, update] = useStreakState();
  const [view, setView] = useState<View>(searchView ?? "home");
  const [activeDate, setActiveDate] = useState<string>(todayIso());

  const streak = useMemo(() => currentStreak(state.entries), [state.entries]);

  const dayCombo = DAY_COMBOS.find((c) => c.id === state.dayComboId)!;
  const nightCombo = NIGHT_COMBOS.find((c) => c.id === state.nightComboId)!;

  const setEntry = (date: string, slot: "morning" | "evening", ids: string[]) => {
    update((s) => ({
      ...s,
      entries: {
        ...s.entries,
        [date]: {
          morning: s.entries[date]?.morning ?? [],
          evening: s.entries[date]?.evening ?? [],
          [slot]: ids,
        },
      },
    }));
  };

  return (
    <AppShell
      subtitle="Daily supplements"
      title={
        view === "home" ? (
          <>Your streak.</>
        ) : view === "morning" ? (
          <>Morning dose</>
        ) : view === "evening" ? (
          <>Evening dose</>
        ) : view === "back-fill" ? (
          <>Back-fill</>
        ) : view === "milestones" ? (
          <>Rewards</>
        ) : view === "setup" ? (
          <>Your combo</>
        ) : (
          <>Lock screen</>
        )
      }
    >
      {view !== "home" && (
        <button
          onClick={() => setView("home")}
          className="mt-3 inline-flex items-center gap-1 text-xs text-warm-grey/80"
        >
          <ChevronLeft className="h-4 w-4" /> Back to streak
        </button>
      )}

      {view === "home" && (
        <HomeView
          streak={streak}
          state={state}
          dayLabel={dayCombo.label}
          nightLabel={nightCombo.label}
          go={setView}
          setActiveDate={setActiveDate}
        />
      )}

      {view === "morning" && (
        <ChecklistView
          slot="morning"
          date={activeDate}
          comboIds={dayCombo.ids}
          entry={state.entries[activeDate]}
          onSave={(ids) => {
            setEntry(activeDate, "morning", ids);
            saveStreakToSheet({ slot: "morning", date: activeDate, ids, phone: phone ?? "" });
            setView("home");
          }}
        />
      )}

      {view === "evening" && (
        <ChecklistView
          slot="evening"
          date={activeDate}
          comboIds={nightCombo.ids}
          entry={state.entries[activeDate]}
          onSave={(ids) => {
            setEntry(activeDate, "evening", ids);
            saveStreakToSheet({ slot: "evening", date: activeDate, ids, phone: phone ?? "" });
            setView("home");
          }}
        />
      )}

      {view === "back-fill" && (
        <BackFillView
          entries={state.entries}
          onPick={(d) => {
            setActiveDate(d);
            setView("morning");
          }}
        />
      )}

      {view === "milestones" && <MilestonesView streak={streak} />}

      {view === "setup" && (
        <SetupView
          dayId={state.dayComboId}
          nightId={state.nightComboId}
          onSave={(d, n) => {
            update((s) => ({ ...s, dayComboId: d, nightComboId: n }));
            setView("home");
          }}
        />
      )}

      {view === "lock" && <LockScreenView dayLabel={dayCombo.label} />}
    </AppShell>
  );
}

/* ---------------- HOME ---------------- */

// Per-supplement pill style (matches reference: B2 yellow, Mg blue, Pm pink, …)
const PILL: Record<string, { label: string; bg: string; fg: string }> = {
  ribo:     { label: "B2", bg: "oklch(0.55 0.14 90 / 0.35)",  fg: "oklch(0.92 0.16 95)"  },
  mg:       { label: "Mg", bg: "oklch(0.45 0.14 250 / 0.35)", fg: "oklch(0.86 0.12 245)" },
  premence: { label: "Pm", bg: "oklch(0.5 0.16 15 / 0.35)",   fg: "oklch(0.88 0.14 20)"  },
  coq:      { label: "CoQ",bg: "oklch(0.5 0.16 55 / 0.35)",   fg: "oklch(0.88 0.16 65)"  },
  feverfew: { label: "FF", bg: "oklch(0.45 0.14 155 / 0.35)", fg: "oklch(0.86 0.14 155)" },
  vitd:     { label: "D3", bg: "oklch(0.55 0.14 80 / 0.35)",  fg: "oklch(0.92 0.18 95)"  },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LETTERS = ["S","M","T","W","T","F","S"];

function statusLabel(streak: number) {
  if (streak >= 60) return "Thriving";
  if (streak >= 30) return "Strong";
  if (streak >= 7)  return "Growing";
  if (streak >= 1)  return "Sprout";
  return "Plant me";
}

function HomeView({
  streak,
  state,
  go,
  setActiveDate,
}: {
  streak: number;
  state: ReturnType<typeof useStreakState>[0];
  dayLabel: string;
  nightLabel: string;
  go: (v: View) => void;
  setActiveDate: (d: string) => void;
}) {
  const today = state.entries[todayIso()];
  const morningTaken = today?.morning?.length ?? 0;
  const eveningTaken = today?.evening?.length ?? 0;

  const dayCombo = DAY_COMBOS.find((c) => c.id === state.dayComboId)!;
  const nightCombo = NIGHT_COMBOS.find((c) => c.id === state.nightComboId)!;

  // Total points across all logged days
  const totalPoints = Object.values(state.entries).reduce((sum, e) => {
    return sum + (scoreForCount(e.morning?.length ?? 0) + scoreForCount(e.evening?.length ?? 0)) * 10;
  }, 0);

  const next = MILESTONES.find((m) => streak < m.days);
  const progress = next ? Math.min(100, (streak / next.days) * 100) : 100;

  const now = new Date();
  const dateLabel = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const todayDow = now.getDay(); // 0..6 (Sun..Sat)

  return (
    <div className="mt-4 space-y-5">
      {/* HERO — streak + plant + milestone bar */}
      <div className="rounded-3xl bg-card border border-border p-5 relative overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-32 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(70% 80% at 50% 0%, var(--streak-soft), transparent)",
          }}
        />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif-display text-[64px] leading-none tabular-nums">
                {streak}
              </span>
              <span className="text-warm-grey/80 text-[14px] font-medium">days</span>
            </div>
            <span className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--streak-soft)] text-[var(--streak)] text-[12px] font-semibold">
              <Heart className="h-3.5 w-3.5" />
              {statusLabel(streak)}
            </span>
            <p className="font-serif-display text-[18px] leading-snug mt-3">
              I showed up for my migraine.
            </p>
            <p className="text-[12px] text-warm-grey/80 mt-1">
              {streak >= 14
                ? "Two strong weeks of self-care."
                : streak >= 7
                ? "One full week of showing up."
                : streak > 0
                ? `${streak} day${streak > 1 ? "s" : ""} of caring for yourself.`
                : "Tap a dose to begin."}
            </p>

          </div>
          <div className="shrink-0">
            <StreakPlant days={streak} size={120} />
          </div>
        </div>

        {/* Milestone progress with 3 stops */}
        <div className="relative mt-5">
          <div className="flex items-center justify-between text-[11px] mb-2">
            <span className="text-[var(--streak)] font-semibold">
              {next ? `${next.days - streak} days to ${next.reward}` : "All milestones cleared"}
            </span>
            <span className="text-warm-grey/80 tabular-nums">{totalPoints.toLocaleString()} pts</span>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-visible">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${progress}%`, background: "var(--streak)" }}
            />
            {MILESTONES.map((m) => {
              const left = Math.min(100, (m.days / 90) * 100);
              const reached = streak >= m.days;
              return (
                <span
                  key={m.days}
                  className="absolute -top-1 h-4 w-4 rounded-full border-2"
                  style={{
                    left: `calc(${left}% - 8px)`,
                    background: reached ? "var(--streak)" : "var(--card)",
                    borderColor: reached ? "var(--streak)" : "var(--border)",
                  }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-warm-grey/70 tabular-nums">
            {MILESTONES.map((m) => (
              <span key={m.days}>
                {m.days} · {m.reward.replace(/^\D*/, "").replace(" off", "%") || m.reward}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* TODAY */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-serif-display text-[22px]">Today</p>
          <span className="text-[12px] text-warm-grey/70">{dateLabel}</span>
        </div>
        <div className="space-y-2">
          <DoseRow
            slot="morning"
            time="12:30 PM"
            comboIds={dayCombo.ids}
            taken={today?.morning ?? []}
            onLog={() => {
              setActiveDate(todayIso());
              go("morning");
            }}
          />
          <DoseRow
            slot="evening"
            time="7:30 PM"
            comboIds={nightCombo.ids}
            taken={today?.evening ?? []}
            onLog={() => {
              setActiveDate(todayIso());
              go("evening");
            }}
          />

        </div>
      </div>

      {/* THIS WEEK */}
      <div>
        <p className="font-serif-display text-[22px] mb-2">This week</p>
        <div className="rounded-3xl bg-card border border-border p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const offset = i - todayDow;
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const key = isoDate(d);
              const e = state.entries[key];
              const count = (e?.morning?.length ?? 0) + (e?.evening?.length ?? 0);
              const done = count > 0;
              const isFuture = offset > 0;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-warm-grey/70">{DAY_LETTERS[i]}</span>
                  <span
                    className={cn(
                      "h-9 w-9 rounded-full grid place-items-center",
                      done
                        ? "bg-[var(--streak)] text-[var(--streak-foreground)]"
                        : isFuture
                        ? "bg-muted/50 text-warm-grey/40"
                        : "bg-muted text-warm-grey/60",
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : (
                      <span className="text-[10px] tabular-nums">{d.getDate()}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-warm-grey/70 mt-2 px-1">
          You can log today or back-fill a missed day — never a day that hasn't happened yet.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2">
        <ActionTile
          icon={<ChevronLeft className="h-4 w-4" />}
          label="Back-fill a day"
          onClick={() => go("back-fill")}
        />
        <ActionTile
          icon={<Gift className="h-4 w-4" />}
          label="Rewards"
          onClick={() => go("milestones")}
        />
        <ActionTile
          icon={<Settings2 className="h-4 w-4" />}
          label="My combo"
          onClick={() => go("setup")}
        />
        <ActionTile
          icon={<Bell className="h-4 w-4" />}
          label="Notification preview"
          onClick={() => go("lock")}
        />
      </div>
    </div>
  );
}

function DoseRow({
  slot,
  time,
  comboIds,
  taken,
  onLog,
}: {
  slot: "morning" | "evening";
  time: string;
  comboIds: string[];
  taken: string[];
  onLog: () => void;
}) {
  const total = comboIds.length;
  const count = taken.length;
  const complete = count >= total && total > 0;
  const points = scoreForCount(count) * 10;
  const Icon = slot === "morning" ? Utensils : UtensilsCrossed;
  const label = slot === "morning" ? "With lunch" : "With dinner";


  return (
    <button
      onClick={onLog}
      className={cn(
        "w-full rounded-2xl border p-3 flex items-center gap-3 text-left transition active:scale-[0.99]",
        complete
          ? "bg-[var(--streak-soft)]/40 border-[var(--streak)]/40"
          : "bg-card border-border",
      )}
    >
      <div
        className={cn(
          "h-11 w-11 rounded-2xl grid place-items-center shrink-0",
          slot === "morning"
            ? "bg-[oklch(0.55_0.14_90_/_0.3)] text-[oklch(0.92_0.16_95)]"
            : "bg-[oklch(0.45_0.1_290_/_0.3)] text-[oklch(0.85_0.12_300)]",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-[14px] font-semibold leading-none">{label}</p>
          <span className="text-[11px] text-warm-grey/70">{time}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {comboIds.map((id) => {
            const on = taken.includes(id);
            const p = PILL[id] ?? { label: id.slice(0, 2).toUpperCase(), bg: "var(--muted)", fg: "var(--foreground)" };
            return (
              <span
                key={id}
                className={cn(
                  "inline-flex items-center gap-1 pl-1.5 pr-2 py-0.5 rounded-full text-[10px] font-bold",
                  !on && "opacity-50",
                )}
                style={{ background: p.bg, color: p.fg }}
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded-full grid place-items-center",
                    on ? "bg-[var(--streak)] text-[var(--streak-foreground)]" : "bg-background/40 text-transparent",
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={4} />
                </span>
                {p.label}
              </span>
            );
          })}
        </div>
      </div>
      <div className="text-right shrink-0">
        {complete ? (
          <>
            <p className="text-[var(--streak)] font-bold text-[14px] tabular-nums leading-none">
              +{points}
            </p>
            <p className="text-[10px] text-warm-grey/70 mt-1">
              {count} of {total} taken
            </p>
          </>
        ) : (
          <>
            <p className="text-primary font-semibold text-[13px] inline-flex items-center gap-0.5">
              Log <ChevronRight className="h-3.5 w-3.5" />
            </p>
            <p className="text-[10px] text-warm-grey/70 mt-0.5">
              {count > 0 ? `${count}/${total}` : "Tap to log"}
            </p>
          </>
        )}
      </div>
    </button>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-card border border-border p-3 text-left text-[12px] font-medium flex items-center justify-between active:scale-[0.98] transition"
    >
      <span>{label}</span>
      <span className="text-warm-grey/70">{icon}</span>
    </button>
  );
}


/* ---------------- CHECKLIST ---------------- */

function ChecklistView({
  slot,
  date,
  comboIds,
  entry,
  onSave,
}: {
  slot: "morning" | "evening";
  date: string;
  comboIds: string[];
  entry?: DayEntry;
  onSave: (ids: string[]) => void;
}) {
  const initial = entry?.[slot] ?? [];
  const [picked, setPicked] = useState<string[]>(initial);
  const supplements = comboIds
    .map((id) => ALL_SUPPLEMENTS.find((s) => s.id === id)!)
    .filter(Boolean);
  const score = scoreForCount(picked.length);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-3xl bg-card border border-border p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
            {slot === "morning" ? "Morning" : "Evening"} · {date}
          </p>
          <span className="text-[11px] text-[var(--streak)] tabular-nums">
            +{score} pts
          </span>
        </div>
        <p className="font-serif-display text-[22px] mt-1">
          Tap what you took.
        </p>
      </div>

      <div className="space-y-2">
        {supplements.map((s) => {
          const on = picked.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={cn(
                "w-full rounded-2xl border p-3 flex items-center gap-3 transition active:scale-[0.99]",
                on
                  ? "bg-[var(--streak-soft)] border-[var(--streak)]/50"
                  : "bg-card border-border",
              )}
            >
              <span className="text-2xl">{s.emoji}</span>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[14px] font-semibold truncate">{s.name}</p>
                <p className="text-[11px] text-warm-grey/80">{s.dose}</p>
              </div>
              <span
                className={cn(
                  "h-7 w-7 rounded-full grid place-items-center border-2",
                  on
                    ? "bg-[var(--streak)] border-[var(--streak)] text-[var(--streak-foreground)]"
                    : "border-border text-transparent",
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onSave(picked)}
        className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-semibold active:scale-[0.99] transition"
      >
        Save
      </button>
    </div>
  );
}

/* ---------------- BACK-FILL ---------------- */

function BackFillView({
  entries,
  onPick,
}: {
  entries: Record<string, DayEntry>;
  onPick: (date: string) => void;
}) {
  // Show last 30 days; future disabled
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });
  return (
    <div className="mt-4 space-y-3">
      <p className="text-[12px] text-warm-grey/80">
        You can log past days, not future ones.
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.reverse().map((d) => {
          const key = isoDate(d);
          const e = entries[key];
          const count = (e?.morning?.length ?? 0) + (e?.evening?.length ?? 0);
          const isToday = key === todayIso();
          return (
            <button
              key={key}
              onClick={() => onPick(key)}
              className={cn(
                "aspect-square rounded-lg border text-[10px] font-medium flex flex-col items-center justify-center transition",
                count > 0
                  ? "border-[var(--streak)]/50 bg-[var(--streak-soft)] text-foreground"
                  : "border-border bg-card text-warm-grey/80",
                isToday && "ring-2 ring-primary",
              )}
            >
              <span className="tabular-nums">{d.getDate()}</span>
              {count > 0 && (
                <span className="text-[9px] text-[var(--streak)]">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- MILESTONES ---------------- */

function MilestonesView({ streak }: { streak: number }) {
  return (
    <div className="mt-4 space-y-3">
      {MILESTONES.map((m) => {
        const earned = streak >= m.days;
        const pct = Math.min(100, (streak / m.days) * 100);
        return (
          <div
            key={m.days}
            className={cn(
              "rounded-2xl border p-4",
              earned
                ? "bg-[var(--streak-soft)] border-[var(--streak)]/50"
                : "bg-card border-border",
            )}
          >
            <div className="flex items-center justify-between">
              <p className="font-serif-display text-[22px]">{m.days} days</p>
              <span
                className={cn(
                  "text-[12px] font-semibold px-2.5 py-1 rounded-full",
                  earned
                    ? "bg-[var(--streak)] text-[var(--streak-foreground)]"
                    : "bg-muted text-warm-grey",
                )}
              >
                {m.reward}
              </span>
            </div>
            <p className="text-[12px] text-warm-grey/80 mt-1">{m.desc}</p>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${pct}%`,
                  background: earned ? "var(--streak)" : "var(--brand-mid-lavender)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- SETUP ---------------- */

function SetupView({
  dayId,
  nightId,
  onSave,
}: {
  dayId: string;
  nightId: string;
  onSave: (d: string, n: string) => void;
}) {
  const [d, setD] = useState(dayId);
  const [n, setN] = useState(nightId);
  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Morning combo
        </p>
        <div className="space-y-2">
          {DAY_COMBOS.map((c) => (
            <ComboRow
              key={c.id}
              label={c.label}
              ids={c.ids}
              active={c.id === d}
              onPick={() => setD(c.id)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Evening combo
        </p>
        <div className="space-y-2">
          {NIGHT_COMBOS.map((c) => (
            <ComboRow
              key={c.id}
              label={c.label}
              ids={c.ids}
              active={c.id === n}
              onPick={() => setN(c.id)}
            />
          ))}
        </div>
      </div>
      <button
        onClick={() => onSave(d, n)}
        className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-semibold"
      >
        Save combo
      </button>
    </div>
  );
}

function ComboRow({
  label,
  ids,
  active,
  onPick,
}: {
  label: string;
  ids: string[];
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      onClick={onPick}
      className={cn(
        "w-full rounded-2xl border p-3 flex items-center gap-3 text-left",
        active
          ? "bg-[var(--streak-soft)] border-[var(--streak)]/50"
          : "bg-card border-border",
      )}
    >
      <div className="flex -space-x-1.5">
        {ids.map((id) => {
          const s = ALL_SUPPLEMENTS.find((x) => x.id === id)!;
          return (
            <span
              key={id}
              className="h-7 w-7 rounded-full bg-background border border-border grid place-items-center text-[14px]"
            >
              {s.emoji}
            </span>
          );
        })}
      </div>
      <p className="text-[13px] font-medium flex-1">{label}</p>
      {active && (
        <Check className="h-4 w-4 text-[var(--streak)]" strokeWidth={3} />
      )}
    </button>
  );
}

/* ---------------- LOCK SCREEN MOCK ---------------- */

function LockScreenView({ dayLabel }: { dayLabel: string }) {
  return (
    <div className="mt-4">
      <div className="rounded-[28px] bg-gradient-to-b from-[oklch(0.18_0.02_285)] to-[oklch(0.1_0.02_285)] border border-border p-4 min-h-[420px] flex flex-col">
        <div className="text-center text-warm-grey/80">
          <p className="text-[11px] uppercase tracking-[0.2em]">Sat 14 Jun</p>
          <p className="font-serif-display text-[56px] leading-none mt-1">
            8:00
          </p>
        </div>
        <div className="mt-8 rounded-2xl bg-card/90 backdrop-blur border border-border p-3 flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--streak)] grid place-items-center shrink-0">
            <Utensils className="h-5 w-5 text-[var(--streak-foreground)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-semibold">Cranberry · With lunch</p>
              <span className="text-[10px] text-warm-grey/70">now</span>
            </div>
            <p className="text-[12px] mt-0.5">
              Take {dayLabel} with your lunch. Tap to mark them off.
            </p>
          </div>
        </div>
        <div className="mt-2 rounded-2xl bg-card/70 backdrop-blur border border-border p-3 flex items-start gap-3 opacity-80">
          <div className="h-9 w-9 rounded-lg bg-[var(--streak-soft)] grid place-items-center shrink-0">
            <UtensilsCrossed className="h-5 w-5 text-[var(--streak)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold">Cranberry · With dinner</p>
            <p className="text-[11px] text-warm-grey/80 mt-0.5">
              Scheduled for 7:30 pm

            </p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-center text-warm-grey/70">
        You get a morning and an evening reminder every day.
      </p>
    </div>
  );
}
