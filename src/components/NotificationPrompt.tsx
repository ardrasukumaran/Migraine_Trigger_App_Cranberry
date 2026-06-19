// src/components/NotificationPrompt.tsx
import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BACKEND_URL = "https://cranberry-notifications.onrender.com";
const FCM_KEY     = "cranberry.fcm_token.v1";
const STREAK_KEY  = "cranberry.streaks.v1";

// Firebase config — hardcoded (public values, safe in frontend)
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCcCVGSMA1nX5f2_jjG1pqkNSDRGduR_p0",
  authDomain:        "meal-reminder-app.firebaseapp.com",
  projectId:         "meal-reminder-app",
  storageBucket:     "meal-reminder-app.appspot.com",
  messagingSenderId: "1034543527787",
  appId:             "1:1034543527787:web:5e04ce5cf292072badbe2e",
};

const VAPID_KEY = "BJv94GZl_CnEMK4TMWxZSWEiF0VE87j0xy6swee4fs3ck6Iw6aloDqz86l9VHKtBFRNMjhbHEb48fD0szET2zSc";

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

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadFirebase() {
  await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
  await loadScript("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");
  return (window as any).firebase;
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
    if (typeof Notification === "undefined") { onDone?.(); return; }
    if (Notification.permission === "denied") { onDone?.(); return; }

    // Only skip if already granted AND token already saved
    if (
      Notification.permission === "granted" &&
      localStorage.getItem(FCM_KEY)
    ) {
      onDone?.();
      return;
    }

    // Show popup after 1 second
    const timer = setTimeout(() => setShow(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  async function handleAllow() {
    setLoading(true);
    try {
      // Step 1: Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permission denied");

      // Step 2: Register service worker
      const reg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js", { scope: "/" }
      );
      await navigator.serviceWorker.ready;

      // Step 3: Load Firebase from CDN
      const firebase = await loadFirebase();
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      const messaging = firebase.messaging();

      // Step 4: Get FCM token
      const token = await messaging.getToken({
        vapidKey:                  VAPID_KEY,
        serviceWorkerRegistration: reg,
      });

      if (!token) throw new Error("No token received");

      // Step 5: Save token locally
      localStorage.setItem(FCM_KEY, token);
      console.log("[FCM] Token obtained:", token.slice(0, 30) + "…");

      // Step 6: Send to backend
      const { dayCombo, nightCombo } = getComboFromStorage();
      await fetch(`${BACKEND_URL}/register-token`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          mobile_number: mobile,
          fcm_token:     token,
          day_combo:     dayCombo,
          night_combo:   nightCombo,
        }),
      });

      console.log("[FCM] Token registered successfully!");

      // Only save to localStorage on successful Allow
      setDone(true);
      setTimeout(() => { setShow(false); onDone?.(); }, 2000);

    } catch (err) {
      console.error("[FCM] Error:", err);
      // On error — don't save to localStorage, ask again next login
      setShow(false);
      onDone?.();
    } finally {
      setLoading(false);
    }
  }

  // Maybe later OR click outside — don't save to localStorage
  // Popup will show again on next login
  function handleSkip() {
    setShow(false);
    onDone?.();
  }

  if (!show) return null;

  return (
    <>
      {/* Backdrop — click outside = same as Maybe later */}
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
          <span className="px-3 py-1.5 rounded-full bg-muted text-[12px] font-medium">🌿 Morning dose</span>
          <span className="px-3 py-1.5 rounded-full bg-muted text-[12px] font-medium">🌙 Evening dose</span>
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
