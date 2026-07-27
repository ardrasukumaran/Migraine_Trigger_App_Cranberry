import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { BottomNav } from "./BottomNav";
import { useAuth } from "@/context/AuthContext";

export function AppShell({
  children,
  title,
  subtitle,
  right,
  bg = "default",
  hideLogout = false,
}: {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  bg?: "default" | "lavender" | "white";
  hideLogout?: boolean;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const bgClass =
    bg === "lavender"
      ? "bg-lavender"
      : bg === "white"
      ? "bg-white"
      : "bg-background";

  function handleLogout() {
    logout();
    navigate({ to: "/login" });
  }

  return (
    <div className={`phone-frame ${bgClass}`}>
      {/* Logout button — hidden on pages that pass hideLogout */}
      {!hideLogout && (
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="absolute top-3 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-muted text-warm-grey/70 hover:bg-accent hover:text-foreground transition active:scale-95"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      )}

      {(title || right) && (
        <header className="px-5 pt-7 pb-4 flex items-end justify-between gap-3">
          <div>
            {subtitle && (
              <p className="text-xs uppercase tracking-[0.18em] text-warm-grey/60 font-medium">
                {subtitle}
              </p>
            )}
            {title && (
              <h1 className="font-serif-display text-[34px] leading-[1.05] text-foreground mt-1">
                {title}
              </h1>
            )}
          </div>
          {right}
        </header>
      )}
      <main className="px-5 scroll-area-pad">{children}</main>
      <BottomNav />
    </div>
  );
}
