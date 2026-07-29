import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { saveAttack } from "@/lib/storage";
import { AppShell } from "@/components/AppShell";
import { Berry } from "@/components/Berry";
import { Check, ArrowLeft, ArrowRight, Sparkles, Calendar as CalendarIcon, MessageCircle } from "lucide-react";
import { FOOD_SETS, NON_FOOD_SETS } from "@/lib/mock-data";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Log an attack — Migraine tracker" },
      { name: "description", content: "Capture your migraine attack in under a minute." },
    ],
  }),
  component: LogPage,
});

type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Attack", "Food", "Other Triggers", "Done"];

const PAIN_VARS: Record<number, string> = {
  1: "var(--pain-1)",
  2: "var(--pain-2)",
  3: "var(--pain-3)",
  4: "var(--pain-4)",
  5: "var(--pain-5)",
  6: "var(--pain-6)",
  7: "var(--pain-7)",
  8: "var(--pain-8)",
  9: "var(--pain-9)",
  10: "var(--pain-10)",
};

function painLabel(n: number) {
  if (n <= 3) return "Mild";
  if (n <= 6) return "Moderate";
  if (n <= 8) return "Severe";
  return "Debilitating";
}

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function LogPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [date, setDate] = useState<Date>(() => todayDate());
  const [dateOpen, setDateOpen] = useState(false);
  const [status, setStatus] = useState<string>("Just started");
  const [others, setOthers] = useState("");

  function isToday(d: Date) {
    const t = todayDate();
    return d.getTime() === t.getTime();
  }

  function isYesterday(d: Date) {
    const y = todayDate();
    y.setDate(y.getDate() - 1);
    return d.getTime() === y.getTime();
  }

  function isOlderThanYesterday(d: Date) {
    const y = todayDate();
    y.setDate(y.getDate() - 1);
    return d.getTime() < y.getTime();
  }

  function handleDateSelect(d: Date) {
    setDate(d);
    setDateOpen(false);
    if (isYesterday(d) && status === "Just started") setStatus("Ongoing");
    else if (isOlderThanYesterday(d)) setStatus("Done");
  }

  const [intensity, setIntensity] = useState(0);
  const [duration, setDuration] = useState("3–6h");
  const [foods, setFoods] = useState<string[]>([]);
  const [foodSetIdx, setFoodSetIdx] = useState(0);
  const [nonFoods, setNonFoods] = useState<string[]>([]);
  const [nonFoodSetIdx, setNonFoodSetIdx] = useState(0);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const next = () => {
    if (step === 1 && foodSetIdx < FOOD_SETS.length - 1) {
      setFoodSetIdx(foodSetIdx + 1);
      return;
    }
    if (step === 2 && nonFoodSetIdx < NON_FOOD_SETS.length - 1) {
      setNonFoodSetIdx(nonFoodSetIdx + 1);
      return;
    }
    // Persist when completing the last non-food step → done screen
    if (step === 2) {
      saveAttack({
        date: format(date, 'yyyy-MM-dd'),
        intensity,
        status,
        duration,
        foods,
        nonFoodTriggers: nonFoods,
        others,
      });
    }
    setStep((Math.min(step + 1, 3)) as Step);
  };
  const back = () => {
    if (step === 1 && foodSetIdx > 0) {
      setFoodSetIdx(foodSetIdx - 1);
      return;
    }
    if (step === 2 && nonFoodSetIdx > 0) {
      setNonFoodSetIdx(nonFoodSetIdx - 1);
      return;
    }
    if (step === 0) {
      navigate({ to: "/" });
      return;
    }
    setStep((Math.max(step - 1, 0)) as Step);
  };

  const progress =
    step === 3
      ? 100
      : ((step +
          (step === 1 ? foodSetIdx / FOOD_SETS.length : 0) +
          (step === 2 ? nonFoodSetIdx / NON_FOOD_SETS.length : 0)) /
          3) *
        100;

  const painColor = useMemo(() => PAIN_VARS[intensity] ?? "var(--muted-foreground)", [intensity]);

  return (
    <div className="phone-frame bg-background">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <button onClick={back} className="h-10 w-10 -ml-2 grid place-items-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
          {STEP_LABELS[step]}
        </p>
        {step === 0 ? (
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-primary-foreground px-2.5 py-1.5 rounded-full bg-primary">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(date, "EEE, MMM d")}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) handleDateSelect(d); }}
                disabled={(d) => d > new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        ) : (
          <div className="w-10" />
        )}
      </header>
      <div className="px-5">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <main className="px-5 mt-6 scroll-area-pad">
        {step === 0 && (
          <section>
            <h2 className="font-serif-display text-[28px] leading-tight">
              How intense is the pain?
            </h2>
            <p className="text-sm text-warm-grey/80 mt-1">
              Tap a number from 1 to 10.
            </p>

            <div className="mt-6 rounded-3xl bg-card border border-border p-5 text-center">
              <p className="font-serif-display text-[64px] leading-none" style={{ color: painColor }}>
                {intensity === 0 ? "–" : intensity}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 mt-1">
                {intensity === 0 ? "Tap to select" : painLabel(intensity)}
              </p>
              <div className="mt-5 grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const on = intensity === n;
                  const c = PAIN_VARS[n];
                  return (
                    <button
                      key={n}
                      onClick={() => setIntensity(n)}
                      aria-label={`Pain ${n}`}
                      className="aspect-square rounded-full grid place-items-center font-bold text-[15px] border-2 transition active:scale-95"
                      style={{
                        background: on ? c : "transparent",
                        borderColor: c,
                        color: on ? "var(--brand-ink)" : c,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-6 text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
              Attack status
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Just started", "Ongoing", "Done"].map((s) => {
                const disabled =
                  (s === "Just started" && !isToday(date)) ||
                  (s === "Ongoing" && isOlderThanYesterday(date));
                return (
                  <button
                    key={s}
                    disabled={disabled}
                    onClick={() => {
                      setStatus(s);
                      if (s === "Just started") {
                        setDate(todayDate());
                        setDuration("<3h");
                      } else if (duration === "<3h") {
                        setDuration("3–6h");
                      }
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                      disabled
                        ? "bg-card border-border text-foreground/30 cursor-not-allowed"
                        : status === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <p className={`mt-6 text-xs uppercase tracking-[0.18em] font-semibold ${status === "Just started" ? "text-warm-grey/70" : "text-warm-grey/70"}`}>
              Duration so far
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["<3h", "3–6h", "6h", ">6h", "24h"].map((d) => {
                const disabledForStatus =
                  (status === "Just started" && d !== "<3h") ||
                  (status !== "Just started" && d === "<3h");
                return (
                  <button
                    key={d}
                    disabled={disabledForStatus}
                    onClick={() => setDuration(d)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                      disabledForStatus
                        ? "bg-card border-border text-foreground/30 cursor-not-allowed"
                        : duration === d
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === 1 && (
          <section>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
                  Food set {foodSetIdx + 1} of {FOOD_SETS.length}
                </p>
                <h2 className="font-serif-display text-[26px] leading-tight mt-1">
                  Understanding food triggers
                </h2>
              </div>
              <Berry mood="clipboard" size={64} />
            </div>
            <p className="text-sm text-warm-grey/80 mt-2">
              Tap anything you consumed in the 24 hours leading to the migraine.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {FOOD_SETS[foodSetIdx].items.map((item) => {
                const on = foods.includes(item.name);
                return (
                  <button
                    key={item.name}
                    onClick={() => toggle(foods, item.name, setFoods)}
                    className={`rounded-2xl border-2 flex flex-col items-center justify-start px-1.5 pt-3 pb-2 gap-1.5 transition relative ${
                      on
                        ? "bg-mid-lavender/30 border-primary scale-[0.97]"
                        : "bg-card border-border hover:border-primary/40"
                    }`}
                  >
                    <img
                      src={item.icon}
                      alt={item.name}
                      className="object-contain select-none shrink-0" style={{ width: 75, height: 75 }}
                    />
                    <span className={`text-[9px] font-semibold leading-tight text-center break-words w-full ${on ? "text-primary" : "text-foreground"}`}>
                      {item.name}
                    </span>
                    {on && (
                      <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-1.5">
              {FOOD_SETS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === foodSetIdx ? "w-6 bg-primary" : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>

          </section>
        )}

        {step === 2 && (
          <section>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold">
                  {nonFoodSetIdx + 1} of {NON_FOOD_SETS.length}
                </p>
                <h2 className="font-serif-display text-[26px] leading-tight mt-1">
                  Understanding other triggers
                </h2>
              </div>
              <Berry mood="clipboard" size={64} />
            </div>
            <p className="text-sm text-warm-grey/80 mt-2">
              Tap anything you experienced in the 24 hours leading to the migraine.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2.5 items-start">
              {NON_FOOD_SETS[nonFoodSetIdx].items.map((item) => {
                const on = nonFoods.includes(item.name);
                return (
                  <button
                    key={item.name}
                    onClick={() => toggle(nonFoods, item.name, setNonFoods)}
                    className={`rounded-2xl border-2 flex flex-col items-center justify-start px-1.5 pt-3 pb-2 gap-1.5 transition relative h-auto ${
                      on
                        ? "bg-mid-lavender/30 border-primary scale-[0.97]"
                        : "bg-card border-border hover:border-primary/40"
                    }`}
                  >
                    <img
                      src={item.icon}
                      alt={item.name}
                      className="object-contain select-none shrink-0"
                      style={{ width: 100, height: 100 }}
                    />
                    <span className={`text-[9px] font-semibold leading-tight text-center w-full [overflow-wrap:anywhere] ${on ? "text-primary" : "text-foreground"}`}>
                      {item.name}
                    </span>
                    {on && (
                      <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-1.5">
              {NON_FOOD_SETS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === nonFoodSetIdx ? "w-6 bg-primary" : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>

            {nonFoodSetIdx === NON_FOOD_SETS.length - 1 && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/70 font-semibold mb-2">
                  Others
                </p>
                <textarea
                  value={others}
                  onChange={(e) => setOthers(e.target.value)}
                  placeholder="Any other triggers, symptoms, or notes..."
                  rows={3}
                  className="w-full rounded-2xl bg-card border border-border text-foreground text-sm px-4 py-3 placeholder:text-warm-grey/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition resize-none"
                />
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="text-center pt-8">
            <Berry mood="trophy" size={160} className="mx-auto" />
            <h2 className="font-serif-display text-[32px] leading-tight mt-4">
              Logged. Take it easy.
            </h2>
            <p className="text-sm text-warm-grey/80 mt-2 max-w-[280px] mx-auto">
              I'll watch this one carefully — three more like it and we may have a pattern.
            </p>
            <div className="mt-6 inline-flex chip">
              <Sparkles className="h-3.5 w-3.5" /> +25 berries earned
            </div>
            <div className="mt-8 grid grid-cols-1 gap-3">
              <button
                onClick={() => navigate({ to: "/" })}
                className="rounded-2xl bg-primary text-primary-foreground py-3 font-semibold text-sm"
              >
                Done
              </button>
              <a
                href="https://wa.me/15557047540?"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl bg-card border border-border text-foreground py-3 font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-4 w-4" /> Chat with Expert
              </a>
              <Link
                to="/period"
                className="rounded-2xl bg-card border border-[#F2B8BF]/30 text-[#F2B8BF] py-3 font-semibold text-sm inline-flex items-center justify-center gap-2"
              >
                <CalendarIcon className="h-4 w-4" /> Log Period
              </Link>
            </div>
          </section>
        )}

        {step < 3 && (
          <div className="mt-10">
            <button
              onClick={next}
              className="w-full rounded-full bg-primary text-primary-foreground py-4 font-semibold text-[15px] flex items-center justify-center gap-2 ring-soft"
            >
              {step === 2 && nonFoodSetIdx === NON_FOOD_SETS.length - 1 ? "Finish" : "Continue"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
