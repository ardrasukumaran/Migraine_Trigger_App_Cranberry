import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft } from "lucide-react";
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
import { PHASE, usePeriodState, nextPeriodDate, getAvgCycleLength, assignCycleIds, computeCycleMetrics, computeIrregularRange } from "@/lib/period-data";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/period/calendar")({
  head: () => ({
    meta: [
      { title: "Cycle calendar — Cranberry" },
      { name: "description", content: "Month-by-month view of your period and predicted next period." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { phone } = useAuth();
  const [state, update] = usePeriodState();
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  const TODAY = useMemo(() => new Date(), []);
  const sorted = [...state.logs].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastLog = sorted[0] ?? null;
  const baselinePrev = state.baselinePrevPeriodDate ?? "1900-01-01";
  const avgCycle = getAvgCycleLength(state.logs, state.baselineCycleLength, baselinePrev);

  const predictedNext = lastLog ? nextPeriodDate(lastLog.startDate, avgCycle) : addDays(TODAY, 28);
  // End the calendar at the later of: 3 months from today OR the predicted next period month
  const threeAhead = startOfMonth(new Date(TODAY.getFullYear(), TODAY.getMonth() + 3, 1));
  const anchor = startOfMonth(predictedNext) > threeAhead ? startOfMonth(predictedNext) : threeAhead;
  const months: Date[] = [];
  for (let i = 12; i >= 0; i--) {
    months.push(startOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)));
  }

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
      {/* Sticky header: top bar + weekday labels */}
      <div className="sticky top-0 z-20 bg-[#1A0F1E] -mx-5 px-5 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <Link
            to="/period"
            aria-label="Back to period"
            className="h-9 w-9 rounded-full grid place-items-center bg-[#F2B8BF]/20 text-[#F2B8BF] hover:bg-[#F2B8BF]/30 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <p className="text-sm font-semibold">Calendar</p>
          <div className="w-9" />
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] uppercase text-warm-grey/60 text-center">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </div>

      <div className="mt-1 space-y-6">
        {months.map((m) => (
          <MonthGrid
            key={m.toISOString()}
            month={m}
            today={TODAY}
            periodLogs={state.logs}
            periodDays={state.periodLength}
            predictedStart={lastLog ? nextPeriodDate(lastLog.startDate, avgCycle) : null}
            selectedStart={selectedStart}
            onSelect={setSelectedStart}
            isCurrent={isSameMonth(m, TODAY)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-warm-grey/80">
        <LegendDot solid /> Period
        <LegendDot /> Predicted
      </div>

      <div className="h-28" />

      {/* Bottom action */}
      <div className="fixed inset-x-0 bottom-[88px] z-30 pointer-events-none">
        <div className="w-full max-w-[430px] mx-auto px-5 pointer-events-auto">
          <button
            onClick={saveSelectedPeriod}
            disabled={!selectedStart}
            className={`w-full rounded-full font-semibold py-3.5 transition ${
              selectedStart
                ? "bg-[#d9a5ab] hover:bg-[#d9a5ab]/90 text-[#1A0F1E] shadow-lg shadow-[#d9a5ab]/25"
                : "bg-muted text-warm-grey/50 cursor-not-allowed"
            }`}
          >
            {selectedStart ? `Save · ${format(selectedStart, "d MMM")}` : "Tap a day to log period"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function LegendDot({ solid }: { solid?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={
          solid
            ? { backgroundColor: PHASE.period.color }
            : { border: `1.5px solid ${PHASE.period.color}` }
        }
      />
    </span>
  );
}

function MonthGrid({
  month,
  today,
  periodLogs,
  periodDays,
  predictedStart,
  selectedStart,
  onSelect,
  isCurrent,
}: {
  month: Date;
  today: Date;
  periodLogs: { startDate: string }[];
  periodDays: number;
  predictedStart: Date | null;
  selectedStart: Date | null;
  onSelect: (d: Date) => void;
  isCurrent?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isCurrent && ref.current) {
      ref.current.scrollIntoView({ block: "start" });
    }
  }, [isCurrent]);

  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(first, { weekStartsOn: 1 }),
    end: endOfWeek(last, { weekStartsOn: 1 }),
  });

  const predictedEnd = predictedStart ? addDays(predictedStart, periodDays - 1) : null;

  const inLogged = (d: Date) =>
    periodLogs.some((log) => {
      const s = new Date(log.startDate + "T00:00:00");
      const e = addDays(s, periodDays - 1);
      return d >= s && d <= e;
    });

  const inPredicted = (d: Date) =>
    predictedStart != null && predictedEnd != null && d >= predictedStart && d <= predictedEnd;

  const inSelected = (d: Date) => {
    if (!selectedStart) return false;
    return d >= selectedStart && d <= addDays(selectedStart, periodDays - 1);
  };

  return (
    <div ref={ref}>
      <p className="text-center text-lg font-semibold mb-3">{format(month, "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = isSameMonth(d, month);
          const isToday = isSameDay(d, today);
          const isFuture = d > today;
          const logged = inMonth && (inLogged(d) || inSelected(d));
          const predicted = inMonth && inPredicted(d) && !logged;
          const disabled = !inMonth || isFuture;
          return (
            <button
              key={d.toISOString()}
              onClick={() => !disabled && onSelect(d)}
              disabled={disabled}
              className={`aspect-square grid place-items-center text-sm relative transition ${
                inMonth
                  ? isFuture
                    ? "text-warm-grey/40"
                    : "text-foreground"
                  : "text-transparent cursor-default"
              } ${disabled ? "cursor-not-allowed" : ""}`}
            >
              {logged && <DropletIcon filled />}
              {predicted && <DropletIcon />}
              {inMonth && isToday && !logged && !predicted && (
                <span className="absolute inset-2 rounded-full ring-2 ring-[#C7B8EA]" />
              )}
              <span
                className={`relative z-10 ${logged ? "text-[var(--brand-ink)] font-bold" : ""} ${
                  isToday ? "font-bold" : ""
                }`}
              >
                {format(d, "d")}
              </span>
              {inMonth && isToday && (
                <span className="absolute -bottom-0.5 text-[7px] tracking-[0.15em] text-warm-grey/70">
                  TODAY
                </span>
              )}
            </button>
          );
        })}
      </div>
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
