import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RECENT_ATTACKS, TOP_TRIGGERS, CALENDAR_DATA } from "@/lib/mock-data";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useStreakState, isoDate, currentStreak, type DayEntry } from "@/lib/streak-store";
import { DAY_COMBOS, NIGHT_COMBOS, scoreForCount, totalPossibleScore, SKIP_SCORE } from "@/lib/supplements";
import { getAttacks } from "@/lib/storage";
import { useState } from "react";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Patterns — Migraine tracker" },
      { name: "description", content: "Your migraine patterns, triggers, and history in one view." },
    ],
  }),
  component: InsightsPage,
});

// ---------- Derived stats ----------
const [attacks] = useState(() => getAttacks());
const totalAttacks     = attacks.length;
const clearDaysLast30  = 30 - Math.min(30, attacks.filter(a => {
  const d = new Date(a.date);
  return (Date.now() - d.getTime()) < 30 * 86400_000;
}).length);


const avgIntensity = attacks.length > 0
  ? Math.round((attacks.reduce((s, a) => s + a.intensity, 0) / attacks.length) * 10) / 10
  : 0;

const minIntensity = attacks.length ? Math.min(...attacks.map(a => a.intensity)) : 0;
const maxIntensity = attacks.length ? Math.max(...attacks.map(a => a.intensity)) : 0;

const durationCounts: Record<string, number> = {};
for (const a of attacks) {
  durationCounts[a.duration] = (durationCounts[a.duration] ?? 0) + 1;
}

const DURATION_OPTIONS = ["<3h", "3-6h", "6h", ">6h", "24h"] as const;
type DurationBucket = (typeof DURATION_OPTIONS)[number];

const DURATION_HEIGHT_PCT: Record<DurationBucket, number> = {
  "<3h": 20,
  "3-6h": 40,
  "6h": 60,
  ">6h": 80,
  "24h": 100,
};

// mode duration for "Typical Duration"
const DURATION_COUNTS: Record<DurationBucket, number> = {
  "<3h": 0,
  "3-6h": 6,
  "6h": 5,
  ">6h": 0,
  "24h": 0,
};

const typicalDuration = Object.keys(durationCounts).length > 0
  ? Object.entries(durationCounts).reduce((best, cur) => cur[1] > best[1] ? cur : best)[0]
  : "—";

function painColor(v: number) {
  if (v <= 0) return "transparent";
  return `var(--pain-${Math.min(10, Math.max(1, Math.round(v)))})`;
}

// ---------- Month-wise mock data ----------
type DayAttack = { day: number; intensity: number; duration: DurationBucket };
type MonthData = { label: string; year: number; monthIndex: number; days: number; attacks: DayAttack[] };

const MONTHS: MonthData[] = [
  {
    label: "Jun 2026",
    year: 2026,
    monthIndex: 5,
    days: 30,
    attacks: [
      { day: 8, intensity: 4, duration: "3-6h" },
      { day: 10, intensity: 7, duration: "6h" },
      { day: 15, intensity: 5, duration: "3-6h" },
      { day: 16, intensity: 6, duration: "6h" },
      { day: 17, intensity: 4, duration: "3-6h" },
      { day: 22, intensity: 5, duration: "3-6h" },
      { day: 24, intensity: 6, duration: "6h" },
      { day: 25, intensity: 4, duration: "3-6h" },
    ],
  },
  {
    label: "May 2026",
    year: 2026,
    monthIndex: 4,
    days: 31,
    attacks: [
      { day: 3, intensity: 8, duration: "3-6h" },
      { day: 7, intensity: 3, duration: "<3h" },
      { day: 14, intensity: 9, duration: "24h" },
      { day: 20, intensity: 5, duration: ">6h" },
      { day: 27, intensity: 8, duration: "6h" },
    ],
  },
  {
    label: "Apr 2026",
    year: 2026,
    monthIndex: 3,
    days: 30,
    attacks: [
      { day: 5, intensity: 6, duration: "6h" },
      { day: 12, intensity: 4, duration: "3-6h" },
      { day: 19, intensity: 7, duration: ">6h" },
      { day: 26, intensity: 5, duration: "3-6h" },
    ],
  },
];

// ---------- Top triggers with counts ----------
const TRIGGERS_WITH_COUNTS = TOP_TRIGGERS.slice(0, 5);

function slotDone(e: DayEntry | undefined, slot: "morning" | "evening", total: number) {
  if (!e) return false;
  if (slot === "morning") return !!e.morningSkipped || (e.morning?.length ?? 0) >= total;
  return !!e.eveningSkipped || (e.evening?.length ?? 0) >= total;
}

function InsightsPage() {
  const [state] = useStreakState();
  const { entries, dayComboId, nightComboId } = state;
  const dayCombo   = DAY_COMBOS.find((c) => c.id === dayComboId)!;
  const nightCombo = NIGHT_COMBOS.find((c) => c.id === nightComboId)!;

  const allDates = Object.keys(entries).sort();
  const totalDaysLogged = allDates.length;
  const streak = currentStreak(entries);

  let bestStreak = 0, run = 0;
  for (const key of allDates) {
    const e = entries[key];
    const active = (e?.morning?.length ?? 0) + (e?.evening?.length ?? 0) > 0;
    run = active ? run + 1 : 0;
    if (run > bestStreak) bestStreak = run;
  }

  const bothDone = allDates.filter((key) =>
    slotDone(entries[key], "morning", dayCombo.ids.length) &&
    slotDone(entries[key], "evening", nightCombo.ids.length)
  ).length;
  const dayDone   = allDates.filter((key) => slotDone(entries[key], "morning", dayCombo.ids.length)).length;
  const nightDone = allDates.filter((key) => slotDone(entries[key], "evening", nightCombo.ids.length)).length;
  const compliance      = totalDaysLogged > 0 ? Math.round((bothDone  / totalDaysLogged) * 100) : 0;
  const dayCompliance   = totalDaysLogged > 0 ? Math.round((dayDone   / totalDaysLogged) * 100) : 0;
  const nightCompliance = totalDaysLogged > 0 ? Math.round((nightDone / totalDaysLogged) * 100) : 0;

  const maxDayScore = totalPossibleScore(dayCombo.ids.length) + totalPossibleScore(nightCombo.ids.length);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = isoDate(d);
    const e = entries[key];
    const ms = e?.morningSkipped ? SKIP_SCORE : scoreForCount(e?.morning?.length ?? 0);
    const es = e?.eveningSkipped ? SKIP_SCORE : scoreForCount(e?.evening?.length ?? 0);
    return {
      label: d.toLocaleDateString("en-GB", { weekday: "short" }),
      score: ms + es,
      pct: maxDayScore > 0 ? ((ms + es) / maxDayScore) * 100 : 0,
    };
  });

  return (
    <AppShell title="Your patterns">
      {/* Header line */}


      {/* YOUR ATTACKS SO FAR */}
      <section className="mt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Your attacks so far
        </p>
        <div className="grid grid-cols-3 gap-2">
          <StatTile big={totalAttacks} label="Total attacks" />
          <StatTile big={avgIntensity} label="Avg pain intensity" />
          <StatTile big={typicalDuration} label="Typical duration" />
        </div>
      </section>

      {/* PAIN INTENSITY */}
      <section className="mt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Pain intensity
        </p>
        <div className="rounded-3xl bg-card border border-border p-4">
          <div className="flex items-end justify-center gap-2 mb-4">
            <span className="font-serif-display text-[44px] leading-none text-primary">
              {avgIntensity}
            </span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-warm-grey/70 pb-2">
              avg / 10
            </span>
          </div>
          <div className="relative h-8 flex items-center">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
            <div
              className="absolute h-3 rounded-full"
              style={{
                left: `${(minIntensity / 10) * 100}%`,
                width: `${((maxIntensity - minIntensity) / 10) * 100}%`,
                background: `linear-gradient(90deg, ${painColor(minIntensity)}, ${painColor(maxIntensity)})`,
              }}
            />
            <div
              className="absolute h-7 w-[3px] rounded-full bg-foreground shadow"
              style={{ left: `calc(${(avgIntensity / 10) * 100}% - 1.5px)` }}
              aria-label={`Average ${avgIntensity}`}
            />
            <span
              className="absolute -translate-x-1/2 text-[10px] font-semibold text-foreground"
              style={{ left: `${(avgIntensity / 10) * 100}%`, top: "28px" }}
            >
              {avgIntensity}
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between text-[11px] text-warm-grey/70">
            <span>Min <span className="text-foreground font-semibold">{minIntensity}</span></span>
            <span>Avg <span className="text-primary font-semibold">{avgIntensity}</span></span>
            <span>Max <span className="text-foreground font-semibold">{maxIntensity}</span></span>
          </div>
        </div>
      </section>

      {/* TOP TRIGGERS */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
            Top triggers
          </p>
        </div>
        <div className="rounded-3xl bg-card border border-border p-4">
          {/* Percentage scale */}
          <div className="flex justify-between text-[10px] text-warm-grey/50 mb-2">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>

          <div className="space-y-3">
            {TRIGGERS_WITH_COUNTS.map((t) => (
              <div key={t.name}>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-warm-grey/80 tabular-nums">
                    {t.correlation}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${t.correlation}%`,
                      background: `linear-gradient(90deg, var(--primary), var(--brand-mid-lavender))`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

     <h2 className="font-serif-display text-[28px] leading-tight text-foreground mt-8 mb-2">
  Your progress
</h2>
      {/* MONTH WISE PATTERN */}
      <section className="mt-6">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-3">
          Month wise pattern
        </p>

        <div className="rounded-3xl bg-card border border-border p-4">
          {/* Legend */}
          <div className="flex items-center justify-between gap-4 flex-wrap pb-4 mb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-24 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--pain-1), var(--pain-4), var(--pain-7), var(--pain-10))",
                }}
              />
              <span className="text-[12px] text-white">Severity</span>
            </div>
            <div className="flex items-end gap-2">
              {DURATION_OPTIONS.map((d) => (
                <div key={d} className="flex flex-col items-center">
                  <div
                    className="w-3 h-6 rounded-[2px] relative overflow-hidden"
                    style={{ background: "#2E1C35" }}
                  >
                    <div
                      className="absolute bottom-0 inset-x-0 bg-primary/70"
                      style={{ height: `${DURATION_HEIGHT_PCT[d]}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white mt-0.5">{d}</span>
                </div>
              ))}
            </div>
          </div>

          <TooltipProvider delayDuration={0}>
            <div className="space-y-5">
              {MONTHS.map((m) => (
                <MonthRow key={m.label} month={m} />
              ))}
            </div>
          </TooltipProvider>
        </div>
      </section>

      {/* RECENT LOGS */}
      <section className="mt-6 mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
          Recent logs
        </p>
        <div className="rounded-3xl bg-card border border-border divide-y divide-border/60 overflow-hidden">
          {RECENT_ATTACKS.slice(0, 5).map((a) => (
            <div key={a.date} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold">{a.date}</p>
                <p className="text-[11px] text-warm-grey/70 truncate mt-0.5">
                  {a.triggers.join(", ")}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-warm-grey/80">
                    {a.duration}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-warm-grey/80">
                    Pain {a.intensity}
                  </span>
                </div>
              </div>
              <div
                className="h-10 w-10 rounded-full grid place-items-center font-bold text-[14px] shrink-0"
                style={{ background: painColor(a.intensity), color: "var(--brand-ink)" }}
              >
                {a.intensity}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function StatTile({ big, label }: { big: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-3 text-center">
      <p className="font-serif-display text-[24px] leading-none">{big}</p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-warm-grey/70 mt-1">
        {label}
      </p>
    </div>
  );
}

function ComplianceBar({ label, pct, highlight }: { label: string; pct: number; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] mb-1.5">
        <span className="font-medium">{label}</span>
        <span className={`tabular-nums font-semibold ${highlight ? "text-primary" : "text-warm-grey/80"}`}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: highlight
              ? "linear-gradient(90deg, var(--primary), var(--brand-mid-lavender))"
              : "var(--primary)",
          }}
        />
      </div>
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const DURATION_LABEL: Record<DurationBucket, string> = {
  "<3h": "<3 hours",
  "3-6h": "3-6 hours",
  "6h": "6 hours",
  ">6h": ">6 hours",
  "24h": "24 hours",
};

function MonthRow({ month }: { month: MonthData }) {
  const byDay = new Map<number, DayAttack>();
  for (const a of month.attacks) {
    const existing = byDay.get(a.day);
    if (!existing) byDay.set(a.day, a);
    else {
      byDay.set(a.day, {
        day: a.day,
        intensity: Math.max(existing.intensity, a.intensity),
        duration:
          DURATION_HEIGHT_PCT[a.duration] > DURATION_HEIGHT_PCT[existing.duration]
            ? a.duration
            : existing.duration,
      });
    }
  }

  const days = Array.from({ length: month.days }, (_, i) => i + 1);
  const slotH = 72;
  const gap = 2;
  const monthName = MONTH_NAMES[month.monthIndex];
  const migraineFreeDays = month.days - byDay.size;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <p className="text-[15px] font-bold text-white leading-tight">{month.label}</p>
          <p className="text-[11px] text-primary font-semibold mb-3">{migraineFreeDays} migraine-free days</p>
        </div>
      </div>
      <div className="flex">
        {/* Y-axis */}
        <div className="relative flex flex-col justify-end pr-2" style={{ width: 36, height: slotH + 16 }}>
          <div className="absolute right-0 top-0 bottom-4 w-px bg-white/20" />
          {DURATION_OPTIONS.map((d) => {
            const label = d.replace("h", "");
            const pct = DURATION_HEIGHT_PCT[d];
            return (
              <span
                key={d}
                className="absolute right-2 text-[9px] text-white/50 tabular-nums"
                style={{ bottom: `calc(${pct}% + 4px)`, transform: "translateY(50%)" }}
              >
                {label}
              </span>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="flex-1">
          <div className="relative w-full" style={{ height: slotH }}>
            {/* Faint horizontal grid lines */}
            {DURATION_OPTIONS.map((d) => (
              <div
                key={d}
                className="absolute inset-x-0 border-t border-dashed border-white/[0.08] z-10 pointer-events-none"
                style={{ bottom: `${DURATION_HEIGHT_PCT[d]}%` }}
              />
            ))}
            <div
              className="flex w-full absolute inset-0 z-0"
              style={{ gap }}
            >
              {days.map((d) => {
                const a = byDay.get(d);
                const fillPct = a ? DURATION_HEIGHT_PCT[a.duration] : 0;
                const color = a ? painColor(a.intensity) : "transparent";
                const slot = (
                  <div
                    className="rounded-[2px] relative overflow-hidden flex-1"
                    style={{ background: "#2E1C35", height: slotH }}
                  >
                    {a && (
                      <div
                        className="absolute bottom-0 inset-x-0"
                        style={{ height: `${fillPct}%`, background: color }}
                      />
                    )}
                  </div>
                );
              if (!a) return <div key={d} className="flex-1 flex">{slot}</div>;
              return (
                <Tooltip key={d}>
                  <TooltipTrigger asChild>
                    <button type="button" className="focus:outline-none flex-1 flex z-0">
                      {slot}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-white text-brand-ink">
                    <div className="text-[11px] leading-tight font-medium space-y-0.5">
                      <div>{ordinal(a.day)} {monthName}</div>
                      <div>Intensity: {a.intensity}/10</div>
                      <div>Duration: {DURATION_LABEL[a.duration]}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
        {/* Date axis */}
          <div className="relative mt-1 h-3 w-full">
            {[1, 5, 10, 15, 20, 25, 30].map((d) => {
              if (d > month.days) return null;
              const leftPct = ((d - 0.5) / month.days) * 100;
              return (
                <span
                  key={d}
                  className="absolute -translate-x-1/2 text-[10px] text-white tabular-nums"
                  style={{ left: `${leftPct}%` }}
                >
                  {d}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
