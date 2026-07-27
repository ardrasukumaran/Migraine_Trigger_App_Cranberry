import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Calendar as CalendarIcon, Plus, ChevronRight, Check, X } from "lucide-react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  PHASE,
  phaseForDay,
  usePeriodState,
  nextPeriodDate,
  daysUntilNext,
  dayInCurrentCycle,
  computeAvgCycleLength,
  buildCycleHistory,
  type PhaseKey,
} from "@/lib/period-data";

export const Route = createFileRoute("/period")({
  head: () => ({
    meta: [
      { title: "Period tracking — Cranberry" },
      { name: "description", content: "Track your cycle, phase, and predicted next period." },
    ],
  }),
  component: PeriodPage,
});

function PeriodPage() {
  const isChild = useRouterState({
    select: (s) =>
      s.location.pathname !== "/period" && s.location.pathname !== "/period/",
  });
  const [state, update] = usePeriodState();
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  const TODAY = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => startOfMonth(TODAY), [TODAY]);
  const gridDays = useMemo(() => {
    const first = startOfWeek(monthStart, { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: first, end: last });
  }, [monthStart]);

  if (isChild) return <Outlet />;

  const sorted = [...state.logs].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastLog = sorted[0] ?? null;
  const avgCycle = computeAvgCycleLength(state.logs);
  const history = buildCycleHistory(state.logs, avgCycle);

  const predictedStart = lastLog ? nextPeriodDate(lastLog.startDate, avgCycle) : null;
  const predictedEnd = predictedStart ? addDays(predictedStart, state.periodDays - 1) : null;
  const daysLeft = lastLog ? daysUntilNext(lastLog.startDate, avgCycle) : null;
  const currentDay = lastLog ? dayInCurrentCycle(lastLog.startDate) : null;

  const inLogged = (d: Date) =>
    state.logs.some((log) => {
      const s = new Date(log.startDate + "T00:00:00");
      const e = addDays(s, state.periodDays - 1);
      return d >= s && d <= e;
    });

  const inPredicted = (d: Date) =>
    predictedStart != null &&
    predictedEnd != null &&
    d >= predictedStart &&
    d <= predictedEnd;

  const inSelected = (d: Date) => {
    if (!selectedStart) return false;
    return d >= selectedStart && d <= addDays(selectedStart, state.periodDays - 1);
  };

  const saveSelectedPeriod = () => {
    if (!selectedStart) return;
    const startDate = selectedStart.toISOString().slice(0, 10);
    update((s) => {
      const alreadyLogged = s.logs.some((l) => l.startDate === startDate);
      if (alreadyLogged) return s;
      const newLogs = [
        { id: `period-${startDate}`, startDate },
        ...s.logs,
      ].sort((a, b) => b.startDate.localeCompare(a.startDate));
      const newCycle = computeAvgCycleLength(newLogs);
      return { ...s, logs: newLogs, cycleLength: newCycle };
    });
    setSelectedStart(null);
  };

  return (
    <AppShell>
      {/* Top toolbar */}
      <div className="mt-4 flex items-center justify-end gap-3">
        <Link
          to="/period/calendar"
          aria-label="Open month view"
          className="h-9 w-9 rounded-full grid place-items-center bg-[#F2B8BF]/20 text-[#F2B8BF] hover:bg-[#F2B8BF]/30 transition"
        >
          <CalendarIcon className="h-4 w-4" />
        </Link>
      </div>

      {/* Mini calendar — current month */}
      <section className="mt-4 rounded-3xl bg-card border border-border p-4">
        <p className="text-sm font-semibold mb-3 text-center">{format(monthStart, "MMMM yyyy")}</p>
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase text-warm-grey/60 text-center mb-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((d) => {
            const inMonth = isSameMonth(d, monthStart);
            const isToday = isSameDay(d, TODAY);
            const isFuture = d > TODAY;
            const logged = inLogged(d) || inSelected(d);
            const predicted = inPredicted(d) && !logged;
            const disabled = !inMonth || isFuture;
            return (
              <button
                key={d.toISOString()}
                onClick={() => !disabled && setSelectedStart(d)}
                disabled={disabled}
                className={`aspect-square grid place-items-center text-sm relative transition ${
                  !inMonth
                    ? "text-transparent cursor-default"
                    : isFuture
                    ? "text-warm-grey/30"
                    : "text-foreground"
                } ${disabled ? "cursor-not-allowed" : ""}`}
              >
                {logged && <DropletIcon filled />}
                {predicted && <DropletIcon />}
                {isToday && !logged && !predicted && (
                  <span className="absolute inset-2 rounded-full ring-2 ring-[#7B6BA8]" />
                )}
                <span
                  className={`relative z-10 ${logged ? "text-[var(--brand-ink)] font-bold" : ""} ${
                    isToday ? "font-bold" : ""
                  }`}
                >
                  {format(d, "d")}
                </span>
              </button>
            );
          })}
        </div>
        {selectedStart && (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setSelectedStart(null)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-[#F2B8BF]/30 bg-card py-2.5 text-sm font-semibold text-[#F2B8BF]"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              onClick={saveSelectedPeriod}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#F2B8BF] py-2.5 text-sm font-semibold text-[#1A0F1E]"
            >
              <Check className="h-3.5 w-3.5" /> Save · {format(selectedStart, "d MMM")}
            </button>
          </div>
        )}
      </section>

      {/* Cycle status */}
      <section className="mt-5 rounded-3xl bg-gradient-to-br from-[#F2B8BF]/20 to-[#FCB3C4]/10 border border-[#F2B8BF]/30 p-5 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-[#F2B8BF] font-semibold">
          {daysLeft === null ? "Start tracking" : "Period in"}
        </p>
        {daysLeft !== null && currentDay !== null ? (
          <>
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span className="text-[56px] leading-none text-foreground font-bold">
                {daysLeft}
              </span>
              <span className="text-base text-warm-grey/80">days</span>
            </div>
            <div className="mt-3 flex justify-center">
              <PhasePill dayInCycle={currentDay} cycleLength={avgCycle} />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-warm-grey/70">
            Tap a day on the calendar above to log your period.
          </p>
        )}
      </section>

      {/* Previous period report */}
      {lastLog && (
        <section className="mt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-3">
            Previous period report
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            <StatPill
              label="Last period"
              value={format(new Date(lastLog.startDate + "T00:00:00"), "d MMM")}
            />
            <StatPill label="Avg cycle" value={`${avgCycle} days`} />
            <StatPill
              label="Next period"
              value={predictedStart ? format(predictedStart, "d MMM") : "—"}
              highlight
            />
          </div>
        </section>
      )}

      {/* Cycle history (last 3) */}
      {history.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
              Cycle history
            </p>
            <Link
              to="/period/history"
              className="text-xs font-semibold text-primary inline-flex items-center gap-0.5"
            >
              See more <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <PhaseLegend inline />
          <div className="mt-3 space-y-4">
            {history.slice(0, 3).map((h, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">
                    {h.ongoing ? "Current cycle · " : ""}
                    {h.days} days
                  </p>
                  <p className="text-[11px] text-warm-grey/70">
                    {format(new Date(h.startDate + "T00:00:00"), "d MMM")} –{" "}
                    {h.ongoing ? "today" : format(new Date(h.endDate + "T00:00:00"), "d MMM")}
                  </p>
                </div>
                <CyclePhaseBar days={h.days} elapsed={h.ongoing ? currentDay ?? h.days : h.days} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Spacer for fixed bottom button + bottom nav */}
      <div className="h-28" />

      {/* Fixed Log period CTA */}
      <div className="fixed inset-x-0 bottom-[68px] z-30 pointer-events-none">
        <div className="w-full max-w-[430px] mx-auto px-5 pointer-events-auto">
          <Link
            to="/period/calendar"
            className="flex items-center justify-center gap-2 w-full rounded-full bg-[#F2B8BF] hover:bg-[#F2B8BF]/90 text-[#1A0F1E] font-semibold py-3.5 shadow-lg shadow-[#F2B8BF]/25 transition"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            Log period
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-card border border-border px-3 py-3 text-center">
      <p className="text-[9px] uppercase tracking-[0.14em] text-warm-grey/60 font-semibold">
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? "text-[#F2B8BF]" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function PhasePill({ dayInCycle, cycleLength }: { dayInCycle: number; cycleLength: number }) {
  const key = phaseForDay(dayInCycle, cycleLength) as PhaseKey;
  const phase = PHASE[key];
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-background/40 border border-white/10 px-3 py-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: phase.color }} />
      <span className="text-xs font-semibold">{phase.name} phase</span>
      <span className="text-xs text-warm-grey/70">· day {dayInCycle}</span>
    </div>
  );
}

/** Segmented phase bar, scrollable horizontally */
export function CyclePhaseBar({ days, elapsed }: { days: number; elapsed: number }) {
  const DAY_W = 12;
  return (
    <div className="mt-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div style={{ width: days * DAY_W }}>
        <div className="flex h-2 overflow-hidden rounded-full">
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const phase = PHASE[phaseForDay(d, days)];
            const faded = d > elapsed;
            return (
              <span
                key={i}
                className="h-full"
                style={{ width: DAY_W, backgroundColor: phase.color, opacity: faded ? 0.3 : 1 }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex text-[9px] text-warm-grey/60 tabular-nums">
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const show = d === 1 || d === days || d % 5 === 0;
            return (
              <span key={i} className="text-center" style={{ width: DAY_W }}>
                {show ? d : ""}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PhaseLegend({ inline = false }: { inline?: boolean } = {}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-warm-grey/85 ${
        inline ? "" : "mt-4 gap-x-4 gap-y-2 text-[11px] justify-center"
      }`}
    >
      {(Object.keys(PHASE) as Array<keyof typeof PHASE>).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE[k].color }} />
          {PHASE[k].name}
        </span>
      ))}
    </div>
  );
}

function DropletIcon({ filled }: { filled?: boolean }) {
  const color = PHASE.period.color;
  return (
    <svg viewBox="0 0 24 32" className="absolute inset-0 m-auto h-[60%] w-[60%]" aria-hidden>
      <path
        d="M12 2 C12 2, 22 14, 22 22 A10 10 0 0 1 2 22 C2 14, 12 2, 12 2 Z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={filled ? 0 : 1.5}
      />
    </svg>
  );
}
