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
import { PHASE, usePeriodState, nextPeriodDate, getAvgCycleLength, assignCycleIds } from "@/lib/period-data";

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
  const [state, update] = usePeriodState();
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  const TODAY = useMemo(() => new Date(), []);
  const sorted = [...state.logs].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastLog = sorted[0] ?? null;
  const baselinePrev = state.baselinePrevPeriodDate ?? "1900-01-01";
  const avgCycle = getAvgCycleLength(state.logs, state.baselineCycleLength, baselinePrev);

  // 12 months back → month of predicted next period (or next month if no data)
  const predictedNext = lastLog ? nextPeriodDate(lastLog.startDate, avgCycle) : addDays(TODAY, 28);
  const anchor = startOfMonth(predictedNext);
  const months: Date[] = [];
  for (let i = 12; i >= 0; i--) {
    months.push(startOfMonth(new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)));
  }

  const saveSelectedPeriod = () => {
    if (!selectedStart) return;
    const startDate = selectedStart.toISOString().slice(0, 10);
    update((s) => {
      const alreadyLogged = s.logs.some((l) => l.startDate === startDate);
      if (alreadyLogged) return s;
      const raw = [{ id: `period-${startDate}`, startDate, cycleId: 0 }, ...s.logs];
      const newLogs = assignCycleIds(raw);
      const bp = s.baselinePrevPeriodDate ?? "1900-01-01";
      const newCycle = getAvgCycleLength(newLogs, s.baselineCycleLength, bp);
      return { ...s, logs: newLogs, cycleLength: newCycle, cycleId: newLogs.length };
    });
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
          <button
            onClick={() => setSelectedStart(TODAY)}
            className="text-sm font-semibold text-[#F2B8BF]"
          >
            Today
          </button>
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
                ? "bg-[#F2B8BF] hover:bg-[#F2B8BF]/90 text-[#1A0F1E] shadow-lg shadow-[#F2B8BF]/25"
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
              {isToday && !logged && !predicted && (
                <span className="absolute inset-2 rounded-full ring-2 ring-[#C7B8EA]" />
              )}
              <span
                className={`relative z-10 ${logged ? "text-[var(--brand-ink)] font-bold" : ""} ${
                  isToday ? "font-bold" : ""
                }`}
              >
                {format(d, "d")}
              </span>
              {isToday && (
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
