import { useEffect, useMemo, useState } from "react";
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
  loadPeriodBaseline,
  nextPeriodDate,
  daysUntilNext,
  dayInCurrentCycle,
  getAvgCycleLength,
  buildCycleHistory,
  assignCycleIds,
  computeCycleMetrics,
  computeIrregularRange,
  type PhaseKey,
} from "@/lib/period-data";
import { useAuth } from "@/context/AuthContext";

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
  const { phone } = useAuth();
  const [state, update] = usePeriodState();
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  // Fetch baseline from Google Sheet when period data has never been loaded
  useEffect(() => {
    if (state.baselineLoaded || !phone) return;
    loadPeriodBaseline(phone).then((baseline) => {
      if (baseline) {
        update((s) => ({ ...s, ...baseline }));
      } else {
        // Mark as loaded even if not found (avoid repeated fetches)
        update((s) => ({ ...s, baselineLoaded: true }));
      }
    });
  }, [phone, state.baselineLoaded, update]);

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

  const baselinePrev = state.baselinePrevPeriodDate ?? "1900-01-01";
  const avgCycle = getAvgCycleLength(state.logs, state.baselineCycleLength, baselinePrev);
  const history = buildCycleHistory(state.logs, state.baselineCycleLength, baselinePrev, state.baselineShortestCycle);
  const currentDay = lastLog ? dayInCurrentCycle(lastLog.startDate) : null;

  // Regular: single prediction
  const predictedStart = lastLog ? nextPeriodDate(lastLog.startDate, avgCycle) : null;
  const daysLeft = lastLog ? daysUntilNext(lastLog.startDate, avgCycle) : null;

  // Irregular: range prediction using shortest/longest from baseline
  const shortCycle = state.shortestCycle;
  const longCycle  = state.longestCycle;
  const irrLow  = lastLog ? daysUntilNext(lastLog.startDate, shortCycle) : null;
  const irrHigh = lastLog ? daysUntilNext(lastLog.startDate, longCycle) : null;
  const irrNextShort = lastLog ? nextPeriodDate(lastLog.startDate, shortCycle) : null;
  const irrNextLong  = lastLog ? nextPeriodDate(lastLog.startDate, longCycle)  : null;

  const isIrregular = state.mode === "irregular";

  const inLogged = (d: Date) =>
    state.logs.some((log) => {
      const s = new Date(log.startDate + "T00:00:00");
      const e = addDays(s, state.periodLength - 1);
      return d >= s && d <= e;
    });

  const inPredicted = (d: Date) => {
    if (!predictedStart) return false;
    const end = addDays(predictedStart, state.periodLength - 1);
    return d >= predictedStart && d <= end;
  };

  const inSelected = (d: Date) => {
    if (!selectedStart) return false;
    return d >= selectedStart && d <= addDays(selectedStart, state.periodLength - 1);
  };

  const saveSelectedPeriod = () => {
    if (!selectedStart) return;
    const startDate = format(selectedStart, "yyyy-MM-dd");
    if (state.logs.some((l) => l.startDate === startDate)) { setSelectedStart(null); return; }

    const bp = state.baselinePrevPeriodDate ?? "1900-01-01";
    const raw = [{ id: `period-${startDate}`, startDate, cycleId: 0 }, ...state.logs];
    const newLogs = assignCycleIds(raw);
    const metrics = computeCycleMetrics(newLogs, state.baselineCycleLength, bp);
    const thisMetric = metrics.find((m) => m.startDate === startDate)!;
    const thisLog = newLogs.find((l) => l.startDate === startDate)!;
    // Bug 3: use the latest chronological period's avg, not the retroactively-added one
    const latestLog = newLogs.reduce((a, b) => a.startDate > b.startDate ? a : b);
    const latestMetric = metrics.find((m) => m.startDate === latestLog.startDate)!;
    const newAvgCycle = latestMetric.avgCycleLength;
    const predicted = nextPeriodDate(latestLog.startDate, newAvgCycle);

    // For irregular mode: recompute shortest/longest cycle range
    let newShortest = state.shortestCycle;
    let newLongest  = state.longestCycle;
    if (state.mode === "irregular") {
      const range = computeIrregularRange(newLogs, state.baselineShortestCycle, state.baselineLongestCycle, bp);
      newShortest = range.shortestCycle;
      newLongest  = range.longestCycle;
    }

    update((s) => ({
      ...s,
      logs: newLogs,
      periodLength: s.periodLength, // Bug 2: explicitly preserve — never change after sheet load
      cycleLength: newAvgCycle,
      cycleId: newLogs.length,
      shortestCycle: newShortest,
      longestCycle: newLongest,
    }));

    const isIrreg = state.mode === "irregular";
    const webhookPayload = {
      phone,
      cycleType:              isIrreg ? "Irregular" : "Regular",
      periodDate:             startDate,
      periodLength:           state.periodLength,
      pmsLength:              state.pmsLength,
      cycleId:                thisLog.cycleId,
      // Regular-only (null for irregular)
      avgCycleLength:         isIrreg ? null : newAvgCycle,
      cycleLength:            isIrreg ? null : thisMetric.cycleLength,
      predictedPeriod:        isIrreg ? null : format(predicted, "yyyy-MM-dd"),
      // Irregular-only (null for regular)
      shortestCycleLength:    isIrreg ? newShortest : null,
      longestCycleLength:     isIrreg ? newLongest  : null,
      shortestPredictedPeriod: isIrreg ? format(nextPeriodDate(startDate, newShortest), "yyyy-MM-dd") : null,
      longestPredictedPeriod:  isIrreg ? format(nextPeriodDate(startDate, newLongest),  "yyyy-MM-dd") : null,
    };

    fetch("https://hook.us1.make.com/bi71vzkpuxaoqj8u1xewo5l3ksetdyiw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    }).catch(console.error);

    setSelectedStart(null);
  };

  return (
    <AppShell hideLogout>
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
            const predicted = !isIrregular && inPredicted(d) && !logged;
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
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#d9a5ab] py-2.5 text-sm font-semibold text-[#1A0F1E]"
            >
              <Check className="h-3.5 w-3.5" /> Save · {format(selectedStart, "d MMM")}
            </button>
          </div>
        )}
      </section>

      {/* Cycle status — Regular vs Irregular */}
      <section className="mt-5 rounded-3xl bg-gradient-to-br from-[#F2B8BF]/20 to-[#FCB3C4]/10 border border-[#F2B8BF]/30 p-5 text-center">
        {isIrregular ? (
          /* ── Irregular ── */
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-[#F2B8BF] font-semibold">
              {irrLow !== null ? "Period in" : "Start tracking"}
            </p>
            {irrLow !== null && irrHigh !== null ? (
              <>
                <div className="mt-2 flex items-baseline justify-center gap-2">
                  <span className="text-[56px] leading-none text-foreground font-bold">
                    <span className="text-[#F2B8BF]">{irrLow}</span>
                    <span className="text-3xl text-foreground/60">–</span>
                    <span className="text-[#F2B8BF]">{irrHigh}</span>
                  </span>
                  <span className="text-base text-warm-grey/80">days</span>
                </div>
                {irrNextShort && irrNextLong && (
                  <p className="mt-3 text-xs text-warm-grey/70">
                    Expected between {format(irrNextShort, "d MMM")} – {format(irrNextLong, "d MMM")}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-warm-grey/50">
                  Your cycle length varies — this is your expected window.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-warm-grey/70">
                Tap a day on the calendar above to log your period.
              </p>
            )}
          </>
        ) : (
          /* ── Regular ── */
          <>
            <p className="text-xs uppercase tracking-[0.18em] text-[#F2B8BF] font-semibold">
              {daysLeft !== null ? "Period in" : "Start tracking"}
            </p>
            {daysLeft !== null && currentDay !== null ? (
              <>
                <div className="mt-2 flex items-baseline justify-center gap-2">
                  <span className="text-[56px] leading-none text-foreground font-bold text-[#F2B8BF]">
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
          </>
        )}
      </section>

      {/* Previous period report */}
      {lastLog && (
        <section className="mt-6">
          <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-3">
            Previous period report
          </p>
          {isIrregular ? (
            <div className="grid grid-cols-3 gap-2.5">
              <StatPill
                label="Last period"
                value={format(new Date(lastLog.startDate + "T00:00:00"), "d MMM")}
              />
              <StatPill
                label="Cycle range"
                value={`${shortCycle}–${longCycle}d`}
              />
              <StatPill
                label="Next period"
                value={irrNextShort && irrNextLong
                  ? `${format(irrNextShort, "d MMM")}–${format(irrNextLong, "d MMM")}`
                  : "—"}
                highlight
                compact
              />
            </div>
          ) : (
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
          )}
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
          {isIrregular && (
            <p className="mt-1 text-[11px] text-warm-grey/50 italic">
              Phases are estimated using your shortest cycle. Irregular cycles may affect accuracy.
            </p>
          )}
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
                <CyclePhaseBar days={h.days} cycleDays={isIrregular ? h.shortestCycleAtLog : h.avgCycleLength} periodDays={state.periodLength} pmsLength={state.pmsLength} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="h-28" />

      {/* Fixed Log period CTA */}
      <div className="fixed inset-x-0 bottom-[88px] z-30 pointer-events-none">
        <div className="w-full max-w-[430px] mx-auto px-5 pointer-events-auto">
          <Link
            to="/period/calendar"
            className="flex items-center justify-center gap-2 w-full rounded-full bg-[#d9a5ab] hover:bg-[#d9a5ab]/90 text-[#1A0F1E] font-semibold py-3.5 shadow-lg shadow-[#d9a5ab]/25 transition"
          >
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            Log period
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function StatPill({ label, value, highlight, compact }: { label: string; value: string; highlight?: boolean; compact?: boolean }) {
  return (
    <div className="rounded-2xl bg-card border border-border px-3 py-3 text-center">
      <p className="text-[9px] uppercase tracking-[0.14em] text-warm-grey/60 font-semibold">
        {label}
      </p>
      <p className={`mt-1 font-semibold leading-tight ${compact ? "text-xs" : "text-sm"} ${highlight ? "text-[#F2B8BF]" : "text-foreground"}`}>
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
      <span className="text-xs font-semibold">Today: {phase.name} phase · day {dayInCycle}</span>
    </div>
  );
}

/** Segmented phase bar, scrollable horizontally.
 *  days      = bar width (actual span between period starts)
 *  cycleDays = avgCycleLength used for phase-boundary math (PMS starts at cycleDays - pmsLength)
 */
export function CyclePhaseBar({ days, cycleDays, periodDays = 5, pmsLength = 5 }: { days: number; cycleDays: number; periodDays?: number; pmsLength?: number }) {
  const DAY_W = 12;
  return (
    <div className="mt-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div style={{ width: days * DAY_W }}>
        <div className="flex h-2 overflow-hidden rounded-full">
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const phase = PHASE[phaseForDay(d, cycleDays, periodDays, pmsLength)];
            return (
              <span
                key={i}
                className="h-full"
                style={{ width: DAY_W, backgroundColor: phase.color }}
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
      <p className="mt-1 text-center text-[10px] text-warm-grey/40 tracking-widest select-none">‹ swipe ›</p>
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
    <svg viewBox="0 0 24 24" className="absolute inset-0 m-auto h-[80%] w-[80%]" aria-hidden>
      <circle cx="12" cy="12" r="9" fill={filled ? color : "none"} stroke={color} strokeWidth={filled ? 0 : 1.5} />
    </svg>
  );
}
