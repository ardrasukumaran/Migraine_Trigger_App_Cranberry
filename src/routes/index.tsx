import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Berry } from "@/components/Berry";
import { Plus, Pencil } from "lucide-react";
import { getAttacks, formatAttackDate, type AttackLog } from "@/lib/storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today — Migraine tracker" },
      { name: "description", content: "Daily check-in and gentle insights for your migraine journey." },
    ],
  }),
  component: TodayPage,
});

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function TodayPage() {
  const [attacks, setAttacks] = useState<AttackLog[]>([]);

  // Load stored attacks on mount (and after navigating back here)
  useEffect(() => {
    setAttacks(getAttacks());
  }, []);

  return (
    <AppShell
      subtitle={todayLabel()}
      title={<>Hi Natasha.<br /><span className="text-primary">How's your head today?</span></>}
      right={<Berry mood="wave" size={68} className="-mt-2 -mr-1" />}
    >
      {/* BIG plus — log attack */}
      <section className="mt-6">
        <Link
          to="/log"
          className="block rounded-[32px] bg-primary text-primary-foreground p-6 ring-soft active:scale-[0.99] transition relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" aria-hidden />
          <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/5" aria-hidden />

          <div className="relative flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-card text-primary grid place-items-center shadow-[0_10px_24px_-8px_rgba(0,0,0,0.4)] shrink-0">
              <Plus className="h-11 w-11" strokeWidth={2.6} />
            </div>
            <div>
              <p className="font-serif-display text-[28px] leading-tight">Log an attack</p>
              <p className="text-[12px] opacity-80 mt-1">Takes under a minute.</p>
            </div>
          </div>
        </Link>
      </section>

      {/* Recent attacks */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">Recent attacks</p>
          <Link to="/calendar" className="text-xs font-semibold text-primary">See all</Link>
        </div>

        {attacks.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <Berry mood="tired" size={56} className="mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">No attacks logged yet</p>
            <p className="text-xs text-warm-grey/70 mt-1">
              Tap the button above to log your first one.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {attacks.slice(0, 3).map((a) => (
              <div key={a.id} className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{formatAttackDate(a.date)}</p>
                  <p className="text-[11px] text-warm-grey/80 truncate">
                    {a.duration}
                    {a.foods.length > 0 && ` · ${a.foods.slice(0, 2).join(', ')}${a.foods.length > 2 ? '…' : ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`h-9 w-9 rounded-full grid place-items-center text-sm font-bold ${
                    a.intensity >= 7 ? "bg-primary text-primary-foreground" : "bg-mid-lavender/50 text-primary-foreground"
                  }`}>
                    {a.intensity}
                  </div>
                  <Link
                    to="/log"
                    aria-label={`Log new attack`}
                    className="h-9 w-9 rounded-full grid place-items-center bg-muted text-foreground hover:bg-accent transition"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
