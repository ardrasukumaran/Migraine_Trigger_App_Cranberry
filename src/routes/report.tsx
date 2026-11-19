import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Berry } from "@/components/Berry";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { TOP_TRIGGERS, RECENT_ATTACKS } from "@/lib/mock-data";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Doctor report — Migraine tracker" },
      { name: "description", content: "A clean PDF summary for your doctor." },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const navigate = useNavigate();
  return (
    <div className="phone-frame bg-background">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/insights" })} className="h-10 w-10 -ml-2 grid place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-[19px] font-sans font-semibold text-warm-grey/60">
          Doctor report
        </p>
        <button className="h-10 w-10 -mr-2 grid place-items-center rounded-full hover:bg-muted">
          <Share2 className="h-5 w-5" />
        </button>
      </header>

      <main className="px-5 scroll-area-pad">
        <section className="rounded-3xl bg-card border border-border p-6">
          <p className="text-[19px] font-sans font-semibold text-warm-grey/60">Summary · Feb–May 2026</p>
          <h1 className="font-sans text-[26px] leading-tight mt-2">
            Migraine activity report
          </h1>
          <p className="text-sm text-warm-grey/70 mt-1">Patient: Anonymous · Generated May 14, 2026</p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              { v: "12", l: "Attacks" },
              { v: "6.4", l: "Avg pain" },
              { v: "4h", l: "Avg duration" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-muted/60 p-3">
                <p className="font-sans text-[24px] text-primary">{s.v}</p>
                <p className="text-sm text-warm-grey/70 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          <h2 className="font-sans text-[18px] mt-6">Likely triggers</h2>
          <ul className="mt-2 space-y-1.5">
            {TOP_TRIGGERS.slice(0, 4).map((t) => (
              <li key={t.name} className="flex justify-between text-sm border-b border-border/60 py-1.5">
                <span>{t.name}</span>
                <span className="font-semibold text-primary">{t.correlation}%</span>
              </li>
            ))}
          </ul>

          <h2 className="font-sans text-[18px] mt-6">Recent attacks</h2>
          <ul className="mt-2 space-y-1.5">
            {RECENT_ATTACKS.map((a) => (
              <li key={a.date} className="text-sm border-b border-border/60 py-1.5">
                <div className="flex justify-between">
                  <span className="font-medium">{a.date}</span>
                  <span className="text-warm-grey/70">{a.duration} · pain {a.intensity}/10</span>
                </div>
                <p className="text-sm text-warm-grey/60">{a.triggers.join(", ")}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-yellow/40 p-3">
            <Berry mood="clipboard" size={48} />
            <p className="text-sm text-warm-grey">
              Bring this to your appointment — it answers most first-visit questions.
            </p>
          </div>
        </section>

        <button className="mt-5 w-full rounded-full bg-primary text-primary-foreground py-4 font-semibold text-[15px] flex items-center justify-center gap-2 ring-soft">
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </main>
    </div>
  );
}
