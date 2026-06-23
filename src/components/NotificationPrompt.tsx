// src/components/NotificationPrompt.tsx
// Uses OneSignal for push notifications (supports Android + iPhone PWA)

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BACKEND_URL     = "https://cranberry-notifications.onrender.com";
const ONESIGNAL_APP_ID = "9532e810-57ec-4019-b7c0-82a5eac1922b";
const PLAYER_KEY       = "cranberry.onesignal_player_id.v1";
const STREAK_KEY       = "cranberry.streaks.v1";

const DAY_COMBO_MAP: Record<string, string> = {
  "day-a": "Ribo + Mg + Premence",
  "day-b": "Ribo + Mg + CoQ",
  "day-c": "Ribo + Mg + Feverfew",
  "day-d": "Ribo + Mg + D3",
};

const NIGHT_COMBO_MAP: Record<string, string> = {
  "night-a": "Mg + CoQ",
  "night-b": "Mg + Premence",
};

function getComboFromStorage() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { dayCombo: "your supplements", nightCombo: "your supplements" };
    const data = JSON.parse(raw);
    return {
      dayCombo:   DAY_COMBO_MAP[data.dayComboId]    ?? "your supplements",
      nightCombo: NIGHT_COMBO_MAP[data.nightComboId] ?? "your supplements",
    };
  } catch {
    return { dayCombo: "your supplements", nightCombo: "your supplements" };
  }
}

function loadOneSignal(): Promise<any> {
  return new Promise((resolve, reject) => {
    // Set up deferred queue before loading script
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];

    if (document.querySelector('script[src*="OneSignalSDK.page.js"]')) {
      // Script already loaded — wait for it
      const wait = setInterval(() => {
        if ((window as any).OneSignal) {
          clearInterval(wait);
          resolve((window as any).OneSignal);
        }
      }, 200);
      setTimeout(() => { clearInterval(wait); reject(new Error("OneSignal timeout")); }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    script.onload = () => {
      const wait = setInterval(() => {
        if ((window as any).OneSignal) {
          clearInterval(wait);
          resolve((window as any).OneSignal);
        }
      }, 200);
      setTimeout(() => { clearInterval(wait); reject(new Error("OneSignal timeout")); }, 10000);
    };
    script.onerror = () => reject(new Error("Failed to load OneSignal SDK"));
    document.head.appendChild(script);
  });
}

interface Props {
  mobile:  string;
  onDone?: () => void;
}

export function NotificationPrompt({ mobile, onDone }: Props) {
  const [show,    setShow]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") { onDone?.(); return; }

    // Only skip if already subscribed
    const existingPlayerId = localStorage.getItem(PLAYER_KEY);
    if (existingPlayerId) { onDone?.(); return; }

    const timer = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  async function handleAllow() {
    setLoading(true);
    try {
      // Load OneSignal SDK
      await loadOneSignal();

      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) throw new Error("OneSignal not loaded");

      // Initialize OneSignal v16
      OneSignal.init({
        appId:                        ONESIGNAL_APP_ID,
        serviceWorkerPath:            "/OneSignalSDKWorker.js",
        notifyButton:                 { enable: false },
        allowLocalhostAsSecureOrigin: true,
      });

      // Wait for init to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Request permission
      await OneSignal.Notifications.requestPermission();

      // Wait for subscription
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Get Player ID
      const playerId = OneSignal.User?.PushSubscription?.id;
      if (!playerId) throw new Error("No player ID received");

      // Save locally
      localStorage.setItem(PLAYER_KEY, playerId);
      console.log("[OneSignal] Player ID:", playerId);

      // Register to backend
      const { dayCombo, nightCombo } = getComboFromStorage();
      await fetch(`${BACKEND_URL}/register-token`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mobile_number: mobile,
          fcm_token:     playerId,
          day_combo:     dayCombo,
          night_combo:   nightCombo,
        }),
      });

      console.log("[OneSignal] Registered successfully!");
      setDone(true);
      setTimeout(() => { setShow(false); onDone?.(); }, 2000);

    } catch (err) {
      console.error("[OneSignal] Error:", err);
      setShow(false);
      onDone?.();
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    setShow(false);
    onDone?.();
  }

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={handleSkip} />
      <div className="fixed inset-x-4 bottom-6 z-50 rounded-3xl bg-card border border-border p-6 shadow-2xl">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-muted grid place-items-center text-warm-grey/70"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="h-14 w-14 rounded-2xl bg-[var(--streak-soft)] grid place-items-center mb-4">
          <Bell className="h-7 w-7 text-[var(--streak)]" />
        </div>

        <h2 className="text-[18px] font-semibold leading-snug">
          Never miss your supplements
        </h2>
        <p className="text-[13px] text-warm-grey/70 mt-2 leading-relaxed">
          Get a gentle reminder at your meal times every day. No spam — just your dose reminder.
        </p>

        <div className="mt-4 flex gap-2">
          <span className="px-3 py-1.5 rounded-full bg-muted text-[12px] font-medium">🌿 Day dose</span>
          <span className="px-3 py-1.5 rounded-full bg-muted text-[12px] font-medium">🌙 Night dose</span>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          {done ? (
            <div className="w-full rounded-2xl bg-[var(--streak-soft)] py-3 text-[14px] font-semibold text-[var(--streak)] text-center">
              ✓ Notifications enabled!
            </div>
          ) : (
            <button
              onClick={handleAllow}
              disabled={loading}
              className={cn(
                "w-full rounded-2xl py-3 text-[14px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.99]",
                "bg-primary text-primary-foreground"
              )}
            >
              {loading ? (
                <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Setting up…</>
              ) : (
                <><Bell className="h-4 w-4" /> Turn on reminders</>
              )}
            </button>
          )}
          {!done && (
            <button
              onClick={handleSkip}
              className="w-full rounded-2xl bg-muted py-3 text-[13px] font-medium text-warm-grey/70"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </>
  );
}
