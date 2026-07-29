import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { usePeriodState, buildCycleHistory } from "@/lib/period-data";
import { CyclePhaseBar, PhaseLegend } from "./period";

export const Route = createFileRoute("/period/history")({
  head: () => ({
    meta: [
      { title: "Cycle history — Cranberry" },
      { name: "description", content: "All logged cycles with their phase breakdown." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [state] = usePeriodState();
  const history = useMemo(
    () => buildCycleHistory(state.logs, state.baselineCycleLength, state.baselinePrevPeriodDate ?? "1900-01-01"),
    [state.logs, state.baselineCycleLength, state.baselinePrevPeriodDate],
  );
  const isIrregular = state.mode === "irregular";
  return (
    <AppShell hideLogout>
      <div className="mt-4 flex items-center gap-3">
        <Link
          to="/period"
          aria-label="Back"
          className="h-9 w-9 rounded-full grid place-items-center bg-muted hover:bg-accent transition"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-sm font-semibold">My cycle history</p>
      </div>

      {history.length === 0 ? (
        <p className="mt-8 text-xs text-warm-grey/60 text-center">
          No cycles logged yet. Log your first period to see history here.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
              All cycles
            </p>
            <PhaseLegend inline />
          </div>
          {isIrregular && (
            <p className="mt-1 text-[11px] text-warm-grey/50 italic">
              Phases are estimated using your shortest cycle. Irregular cycles may affect accuracy.
            </p>
          )}

          <section className="mt-4 space-y-4">
            {history.map((h, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">
                    {h.ongoing ? "Current cycle · " : ""}
                    {h.days} days
                  </p>
                  <p className="text-[11px] text-warm-grey/70">
                    {format(new Date(h.startDate + "T00:00:00"), "d MMM yyyy")} –{" "}
                    {h.ongoing ? "today" : format(new Date(h.endDate + "T00:00:00"), "d MMM yyyy")}
                  </p>
                </div>
                <CyclePhaseBar days={h.days} cycleDays={isIrregular ? state.shortestCycle : h.avgCycleLength} periodDays={state.periodLength} pmsLength={state.pmsLength} />
              </div>
            ))}
          </section>
        </>
      )}
    </AppShell>
  );
}
