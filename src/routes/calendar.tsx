import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Berry } from "@/components/Berry";
import { getAttacks, formatAttackDate, type AttackLog } from "@/lib/storage";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "History — Migraine tracker" },
      { name: "description", content: "Your full migraine attack history." },
    ],
  }),
  component: CalendarPage,
});

const PAIN_COLORS: Record<number, string> = {
  1: "var(--pain-1)", 2: "var(--pain-2)", 3: "var(--pain-3)",
  4: "var(--pain-4)", 5: "var(--pain-5)", 6: "var(--pain-6)",
  7: "var(--pain-7)", 8: "var(--pain-8)", 9: "var(--pain-9)",
  10: "var(--pain-10)",
};

function groupByMonth(attacks: AttackLog[]): { month: string; entries: AttackLog[] }[] {
  const map = new Map<string, AttackLog[]>();
  for (const a of attacks) {
    const key = a.date.slice(0, 7); // "2025-05"
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return Array.from(map.entries()).map(([key, entries]) => ({
    month: new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    entries,
  }));
}

function CalendarPage() {
  const [attacks, setAttacks] = useState<AttackLog[]>([]);

  useEffect(() => {
    setAttacks(getAttacks());
  }, []);

  const groups = groupByMonth(attacks);

  return (
    <AppShell subtitle="History" title="Your history">
      {attacks.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <Berry mood="clipboard" size={120} />
          <h2 className="font-sans text-[26px] mt-4">No attacks yet</h2>
          <p className="text-sm text-warm-grey/80 mt-2 max-w-[260px]">
            Once you log an attack it will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-6 pb-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { v: attacks.length, l: 'Total' },
              {
                v: (attacks.reduce((s, a) => s + a.intensity, 0) / attacks.length).toFixed(1),
                l: 'Avg pain',
              },
              {
                v: (() => {
                  const last = attacks[0];
                  if (!last) return '—';
                  const days = Math.round(
                    (Date.now() - new Date(last.date + 'T00:00:00').getTime()) / 86400000,
                  );
                  return days === 0 ? 'Today' : `${days}d ago`;
                })(),
                l: 'Last attack',
              },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-card border border-border p-3">
                <p className="font-sans text-[22px] text-primary">{s.v}</p>
                <p className="text-sm text-warm-grey/70 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Monthly groups */}
          {groups.map(({ month, entries }) => (
            <div key={month}>
              <p className="text-[19px] font-sans font-semibold text-warm-grey/60 mb-2">
                {month} · {entries.length} attack{entries.length !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2">
                {entries.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3"
                  >
                    {/* Pain badge */}
                    <div
                      className="h-11 w-11 rounded-full grid place-items-center text-[15px] font-bold shrink-0"
                      style={{
                        background: PAIN_COLORS[a.intensity],
                        color: 'var(--brand-ink)',
                      }}
                    >
                      {a.intensity}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{formatAttackDate(a.date)}</p>
                      <p className="text-sm text-warm-grey/70 truncate mt-0.5">
                        {a.duration} · {a.status}
                        {a.foods.length > 0 && ` · ${a.foods.slice(0, 3).join(', ')}${a.foods.length > 3 ? '…' : ''}`}
                      </p>
                    </div>

                    {/* Status dot */}
                    <div
                      className="shrink-0 text-sm font-semibold px-2 py-1 rounded-full"
                      style={{
                        background:
                          a.status === 'Done'
                            ? 'color-mix(in oklab, var(--brand-success) 15%, transparent)'
                            : 'color-mix(in oklab, var(--color-primary) 10%, transparent)',
                        color:
                          a.status === 'Done' ? 'var(--brand-success)' : 'var(--color-primary)',
                      }}
                    >
                      {a.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
