import { Link, useLocation } from "@tanstack/react-router";
import { Home, BarChart3, Flame, Plus, MessageCircle } from "lucide-react";

type Tab = {
  to: string;
  label: string;
  icon: typeof Home;
  external?: boolean;
  highlight?: boolean;
};
const tabs: Tab[] = [
  { to: "/", label: "Today", icon: Home },
  { to: "/insights", label: "Patterns", icon: BarChart3 },
  { to: "/log", label: "Log attack", icon: Plus, highlight: true },
  { to: "/coach", label: "Streaks", icon: Flame },
  { to: "https://15557047540.wa.pulse.is/", label: "Chat", icon: MessageCircle, external: true },
];

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40">
      <div className="w-full max-w-[430px] mx-auto">
        <div className="bg-card/95 backdrop-blur border-t border-border px-1.5 py-2 flex items-center justify-around">

          {tabs.map(({ to, label, icon: Icon, external, highlight }) => {
            const active = !external && loc.pathname === to;
            const className = `flex flex-1 flex-col items-center gap-1 px-1.5 py-1 rounded-2xl text-[11px] font-medium transition ${
              active ? "text-primary" : "text-warm-grey/70"
            }`;
            const iconEl = highlight ? (
              <span className="h-8 w-8 rounded-full grid place-items-center bg-primary text-primary-foreground">
                <Icon className="h-4 w-4" strokeWidth={2.6} />
              </span>
            ) : (
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.4]" : ""}`} />
            );
            if (external) {
              return (
                <a key={to} href={to} target="_blank" rel="noopener noreferrer" className={className}>
                  {iconEl}
                  {label}
                </a>
              );
            }
            return (
              <Link key={to} to={to} className={className}>
                {iconEl}
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
