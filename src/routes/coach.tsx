import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { Berry } from "@/components/Berry";
import { StreakPlant } from "@/components/StreakPlant";
import { saveStreakToSheet, saveComboToSheet } from "@/lib/saveStreak";
import { useAuth } from "@/context/AuthContext";
import {
  ALL_SUPPLEMENTS,
  DAY_COMBOS,
  NIGHT_COMBOS,
  MILESTONES,
  scoreForCount,
  totalPossibleScore,
  SKIP_SCORE,
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
  const [fromBackFill, setFromBackFill] = useState(false);

  const streak = useMemo(() => currentStreak(state.entries), [state.entries]);

  const dayCombo = DAY_COMBOS.find((c) => c.id === state.dayComboId)!;
  const nightCombo = NIGHT_COMBOS.find((c) => c.id === state.nightComboId)!;

  const setEntry = (date: string, slot: "morning" | "evening", ids: string[], skipped = false) => {
    update((s) => ({
      ...s,
      entries: {
        ...s.entries,
        [date]: {
          morning: s.entries[date]?.morning ?? [],
          evening: s.entries[date]?.evening ?? [],
          morningSkipped: s.entries[date]?.morningSkipped,
          eveningSkipped: s.entries[date]?.eveningSkipped,
          [slot]: ids,
          [slot === "morning" ? "morningSkipped" : "eveningSkipped"]: skipped,
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
          <>Day dose</>
        ) : view === "evening" ? (
          <>Night dose</>
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
          setFromBackFill={setFromBackFill}
        />
      )}

      {view === "morning" && (
        <ChecklistView
          slot="morning"
          date={activeDate}
          comboIds={dayCombo.ids}
          entry={state.entries[activeDate]}
          onSave={(ids, skipped) => {
            setEntry(activeDate, "morning", ids, skipped);
            saveStreakToSheet({ slot: "morning", date: activeDate, ids, phone: phone ?? "", skipped });
            if (!fromBackFill) setView("home");
          }}
          onUpdate={(ids) => setEntry(activeDate, "morning", ids)}
          onContinue={fromBackFill ? () => setView("evening") : undefined}
        />
      )}

      {view === "evening" && (
        <ChecklistView
          slot="evening"
          date={activeDate}
          comboIds={nightCombo.ids}
          entry={state.entries[activeDate]}
          onSave={(ids, skipped) => {
            setEntry(activeDate, "evening", ids, skipped);
            saveStreakToSheet({ slot: "evening", date: activeDate, ids, phone: phone ?? "", skipped });
            setFromBackFill(false);
            setView("home");
          }}
          onUpdate={(ids) => setEntry(activeDate, "evening", ids)}
        />
      )}

      {view === "back-fill" && (
        <BackFillView
          entries={state.entries}
          total={dayCombo.ids.length + nightCombo.ids.length}
          onPick={(d, slot) => {
            setActiveDate(d);
            setFromBackFill(true);
            setView(slot);
          }}
        />
      )}

      {view === "milestones" && <MilestonesView />}

      {view === "setup" && (
        <SetupView
          dayId={state.dayComboId}
          nightId={state.nightComboId}
          locked={!!state.comboLocked}
          onSave={(d, n) => {
            update((s) => ({ ...s, dayComboId: d, nightComboId: n, comboLocked: true }));
            const dayLabel   = DAY_COMBOS.find((c) => c.id === d)?.label ?? "";
            const nightLabel = NIGHT_COMBOS.find((c) => c.id === n)?.label ?? "";
            saveComboToSheet({ phone: phone ?? "", dayCombo: dayLabel, nightCombo: nightLabel });
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

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
const DAY_LETTERS = ["S","M","T","W","T","F","S"];

function statusLabel(streak: number) {
  if (streak >= 60) return "Thriving";
  if (streak >= 30) return "Strong";
  if (streak >= 7)  return "Growing";
  if (streak >= 1)  return "Sprout";
  return "Plant me";
}

function slotStreak(
  entries: Record<string, DayEntry>,
  slot: "morning" | "evening",
) {
  return Object.values(entries).filter((e) => (e?.[slot]?.length ?? 0) > 0).length;
}

function DayRing({
  date,
  ratio,
  isToday,
  isFuture,
  letter,
}: {
  date: number;
  ratio: number;
  isToday: boolean;
  isFuture: boolean;
  letter: string;
}) {
  const size = 36;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, ratio));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] text-warm-grey/70">{letter}</span>
      <div className={cn("relative", isToday && "ring-2 ring-warm-grey/40 rounded-full")} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
          />
          {pct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--streak)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
            />
          )}
        </svg>
        <span
          className={cn(
            "absolute inset-0 grid place-items-center text-[11px] tabular-nums",
            isFuture ? "text-warm-grey/40" : "text-foreground",
            isToday && "font-bold",
          )}
        >
          {date}
        </span>
      </div>
    </div>
  );
}

function StreakCard({
  label,
  streak,
  size = 96,
}: {
  label: string;
  streak: number;
  size?: number;
}) {
  return (
    <div className="rounded-3xl bg-card border border-border p-4 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-24 opacity-30 pointer-events-none"
        style={{
          background:
            "radial-gradient(70% 80% at 50% 0%, var(--streak-soft), transparent)",
        }}
      />
      <div className="relative flex flex-col items-center text-center">
        <p className="text-[10px] uppercase tracking-[0.18em] text-warm-grey/70 font-medium">
          {label}
        </p>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-serif-display text-[44px] leading-none tabular-nums">
            {streak}
          </span>
          <span className="text-warm-grey/80 text-[12px] font-medium">days</span>
        </div>
        <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--streak-soft)] text-[var(--streak)] text-[10px] font-semibold">
          <Heart className="h-3 w-3" />
          {statusLabel(streak)}
        </span>
        <div className="mt-1">
          <StreakPlant days={streak} size={size} />
        </div>
        <p className="font-serif-display text-[13px] leading-snug">
          I showed up for my migraine.
        </p>
        <p className="text-[11px] text-warm-grey/80 mt-1">
          {streak >= 14
            ? "Two strong weeks of self-care."
            : streak >= 7
            ? "One full week of showing up."
            : streak > 0
            ? `${streak} day${streak > 1 ? "s" : ""} of caring for yourself.`
            : "Tap a dose to begin."}
        </p>
      </div>
    </div>
  );
}

function HomeView({
  state,
  go,
  setActiveDate,
  setFromBackFill,
}: {
  streak: number;
  state: ReturnType<typeof useStreakState>[0];
  dayLabel: string;
  nightLabel: string;
  go: (v: View) => void;
  setActiveDate: (d: string) => void;
  setFromBackFill: (v: boolean) => void;
}) {
  const today = state.entries[todayIso()];

  const dayCombo = DAY_COMBOS.find((c) => c.id === state.dayComboId)!;
  const nightCombo = NIGHT_COMBOS.find((c) => c.id === state.nightComboId)!;

  const morningLogged = (today?.morning?.length ?? 0) > 0 || !!today?.morningSkipped;
  const eveningLogged = (today?.evening?.length ?? 0) > 0 || !!today?.eveningSkipped;

  const dayStreak = useMemo(() => slotStreak(state.entries, "morning"), [state.entries]);
  const nightStreak = useMemo(() => slotStreak(state.entries, "evening"), [state.entries]);

  const now = new Date();
  const dateLabel = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const todayDow = now.getDay();
  const todayKey = todayIso();
  const maxDayScore = totalPossibleScore(dayCombo.ids.length) + totalPossibleScore(nightCombo.ids.length);

  return (
    <div className="mt-4 space-y-5">
      {/* THIS WEEK — sticky */}
      <div className="sticky top-0 z-20 -mx-5 px-5 bg-background pb-2 pt-1">
        <div className="rounded-3xl bg-card border border-border p-3">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const offset = i - todayDow;
              const d = new Date();
              d.setDate(d.getDate() + offset);
              const key = isoDate(d);
              const e = state.entries[key];
              const morningScore = e?.morningSkipped ? SKIP_SCORE : scoreForCount(e?.morning?.length ?? 0);
              const eveningScore = e?.eveningSkipped ? SKIP_SCORE : scoreForCount(e?.evening?.length ?? 0);
              const ratio = maxDayScore > 0 ? (morningScore + eveningScore) / maxDayScore : 0;
              return (
                <DayRing
                  key={i}
                  letter={DAY_LETTERS[i]}
                  date={d.getDate()}
                  ratio={ratio}
                  isToday={key === todayKey}
                  isFuture={offset > 0}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* STREAK CARDS */}
      <div className="grid grid-cols-2 gap-3">
        <StreakCard label="Day" streak={dayStreak} />
        <StreakCard label="Night" streak={nightStreak} />
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
              setFromBackFill(false);
              setActiveDate(todayIso());
              go("morning");
            }}
            locked={morningLogged}
            skipped={!!today?.morningSkipped}
          />
          <DoseRow
            slot="evening"
            time="7:30 PM"
            comboIds={nightCombo.ids}
            taken={today?.evening ?? []}
            onLog={() => {
              setFromBackFill(false);
              setActiveDate(todayIso());
              go("evening");
            }}
            locked={eveningLogged}
            skipped={!!today?.eveningSkipped}
          />
        </div>
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
  locked,
  skipped,
}: {
  slot: "morning" | "evening";
  time: string;
  comboIds: string[];
  taken: string[];
  onLog: () => void;
  locked?: boolean;
  skipped?: boolean;
}) {
  const total = comboIds.length;
  const count = taken.length;
  const complete = count >= total && total > 0;
  const points = scoreForCount(count);
  const Icon = slot === "morning" ? Utensils : UtensilsCrossed;
  const label = slot === "morning" ? "Day" : "Night";

  const cls = cn(
    "w-full rounded-2xl border p-3 flex items-center gap-3 text-left transition",
    complete ? "bg-[var(--streak-soft)]/40 border-[var(--streak)]/40" : "bg-card border-border",
    !locked && "active:scale-[0.99]",
  );

  const inner = (
    <>
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
        ) : locked && skipped ? (
          <p className="text-[11px] text-warm-grey/50">Skipped</p>
        ) : locked && count > 0 ? (
          <>
            <p className="text-warm-grey/60 font-bold text-[14px] tabular-nums leading-none">
              +{points}
            </p>
            <p className="text-[10px] text-warm-grey/70 mt-1">
              {count}/{total} taken
            </p>
          </>
        ) : locked ? (
          <p className="text-[11px] text-warm-grey/50">Logged</p>
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
    </>
  );

  if (locked) return <div className={cls}>{inner}</div>;
  return <button onClick={onLog} className={cls}>{inner}</button>;
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
  onUpdate,
  onContinue,
}: {
  slot: "morning" | "evening";
  date: string;
  comboIds: string[];
  entry?: DayEntry;
  onSave: (ids: string[], skipped: boolean) => void;
  onUpdate?: (ids: string[]) => void;
  onContinue?: () => void;
}) {
  const initial = entry?.[slot] ?? [];
  const [picked, setPicked] = useState<string[]>(initial);
  const [allDone, setAllDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const supplements = comboIds
    .map((id) => ALL_SUPPLEMENTS.find((s) => s.id === id)!)
    .filter(Boolean);
  const score = scoreForCount(picked.length);

  const toggle = (id: string) => {
    if (allDone) return;
    const newPicked = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(newPicked);
    onUpdate?.(newPicked);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (newPicked.length > 0) {
      // Save after 5 seconds — works for partial AND full selection
      if (newPicked.length >= comboIds.length) setAllDone(true);
      timerRef.current = setTimeout(() => onSave(newPicked, false), 5000);
    } else {
      setAllDone(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {allDone ? (
        <div className="rounded-3xl bg-[var(--streak-soft)] border border-[var(--streak)]/50 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[var(--streak)] grid place-items-center shrink-0">
            <Check className="h-5 w-5 text-[var(--streak-foreground)]" strokeWidth={3} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--streak)]">All done!</p>
            <p className="text-[11px] text-warm-grey/80">{onContinue ? "Tap Night doses to continue." : "Moving to the next step…"}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
              {slot === "morning" ? "Day" : "Night"} · {fmtDate(date)}
            </p>
            <span className="text-[11px] text-[var(--streak)] tabular-nums">
              +{score} pts
            </span>
          </div>
          <p className="font-serif-display text-[22px] mt-1">
            Tap what you took.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {supplements.map((s) => {
          const on = picked.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              disabled={allDone}
              className={cn(
                "w-full rounded-2xl border p-3 flex items-center gap-3 transition",
                on ? "bg-[var(--streak-soft)] border-[var(--streak)]/50" : "bg-card border-border",
                allDone ? "cursor-default opacity-80" : "active:scale-[0.99]",
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

        {/* Skipped row */}
        {!allDone && (
          <button
            onClick={() => onSave([], true)}
            className="w-full rounded-2xl border border-border bg-card p-3 flex items-center gap-3 transition active:scale-[0.99]"
          >
            <span className="text-2xl">🚫</span>
            <div className="flex-1 text-left min-w-0">
              <p className="text-[14px] font-semibold truncate">Skipped</p>
            </div>
            <span className="h-7 w-7 rounded-full grid place-items-center border-2 border-border text-transparent">
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          </button>
        )}

        {/* Night doses shortcut — shown in back-fill morning flow */}
        {onContinue && (
          <button
            onClick={onContinue}
            className="w-full rounded-2xl border border-primary/40 bg-card p-3 flex items-center justify-center gap-2 text-[14px] font-semibold text-primary transition active:scale-[0.99]"
          >
            Night doses <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- BACK-FILL ---------------- */

function BackFillView({
  entries,
  total,
  onPick,
}: {
  entries: Record<string, DayEntry>;
  total: number;
  onPick: (date: string, slot: "morning" | "evening") => void;
}) {
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  });
  return (
    <div className="mt-4 space-y-3">
      <p className="text-[12px] text-warm-grey/80">
        Tap an empty day to log. Fully logged days are locked.
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {days.reverse().map((d) => {
          const key = isoDate(d);
          const e = entries[key];
          const morningLogged = (e?.morning?.length ?? 0) > 0 || !!e?.morningSkipped;
          const eveningLogged = (e?.evening?.length ?? 0) > 0 || !!e?.eveningSkipped;
          const fullyLogged = morningLogged && eveningLogged;
          const anyLogged = morningLogged || eveningLogged;
          const nextSlot: "morning" | "evening" = morningLogged ? "evening" : "morning";
          const count = (e?.morning?.length ?? 0) + (e?.evening?.length ?? 0);
          const isToday = key === todayIso();
          return (
            <button
              key={key}
              onClick={() => !fullyLogged && onPick(key, nextSlot)}
              disabled={fullyLogged}
              className={cn(
                "aspect-square rounded-lg border text-[10px] font-medium flex flex-col items-center justify-center transition",
                fullyLogged
                  ? "border-[var(--streak)]/50 bg-[var(--streak-soft)] text-foreground opacity-40 cursor-not-allowed"
                  : anyLogged
                  ? "border-[var(--streak)]/50 bg-[var(--streak-soft)] text-foreground"
                  : "border-border bg-card text-warm-grey/80",
                isToday && "ring-2 ring-primary",
              )}
            >
              <span className="tabular-nums">{d.getDate()}</span>
              {count >= total && total > 0 ? (
                <span className="text-[9px] text-[var(--streak)]">✓</span>
              ) : count > 0 ? (
                <span className="text-[9px] text-[var(--streak)]">{count}/{total}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- MILESTONES ---------------- */

function MilestonesView() {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <Berry mood="binoculars" size={160} />
      <h2 className="font-serif-display text-[32px] mt-4">Coming soon</h2>
      <p className="text-sm text-warm-grey/80 mt-2 max-w-[260px]">
        Rewards for your consistency are on the way. Keep logging!
      </p>
    </div>
  );
}

/* ---------------- SETUP ---------------- */

function SetupView({
  dayId,
  nightId,
  locked,
  onSave,
}: {
  dayId: string;
  nightId: string;
  locked: boolean;
  onSave: (d: string, n: string) => void;
}) {
  const [d, setD] = useState(dayId);
  const [n, setN] = useState(nightId);
  return (
    <div className="mt-4 space-y-4">
      {locked && (
        <p className="text-[12px] text-warm-grey/70 bg-muted rounded-xl px-3 py-2">
          Your combo is locked. Contact support to change it.
        </p>
      )}
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Day combo
        </p>
        <div className="space-y-2">
          {DAY_COMBOS.map((c) => (
            <ComboRow
              key={c.id}
              label={c.label}
              ids={c.ids}
              active={c.id === d}
              onPick={locked ? undefined : () => setD(c.id)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Night combo
        </p>
        <div className="space-y-2">
          {NIGHT_COMBOS.map((c) => (
            <ComboRow
              key={c.id}
              label={c.label}
              ids={c.ids}
              active={c.id === n}
              onPick={locked ? undefined : () => setN(c.id)}
            />
          ))}
        </div>
      </div>
      {!locked && (
        <button
          onClick={() => onSave(d, n)}
          className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 font-semibold"
        >
          Save combo
        </button>
      )}
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
  onPick?: () => void;
}) {
  return (
    <button
      onClick={onPick}
      disabled={!onPick}
      className={cn(
        "w-full rounded-2xl border p-3 flex items-center gap-3 text-left",
        active
          ? "bg-[var(--streak-soft)] border-[var(--streak)]/50"
          : "bg-card border-border",
        !onPick && "cursor-default",
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
              <p className="text-[12px] font-semibold">Cranberry · Day</p>
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
            <p className="text-[12px] font-semibold">Cranberry · Night</p>
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
