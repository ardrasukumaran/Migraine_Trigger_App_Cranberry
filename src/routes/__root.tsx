import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// ─── Foreground FCM notification handler ─────────────────────────────────────
function useForegroundNotifications() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const scriptUrls = [
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js",
    ];

    function loadScript(src: string): Promise<void> {
      return new Promise((resolve) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
      });
    }

    async function setupForegroundListener() {
      try {
        await Promise.all(scriptUrls.map(loadScript));
        const firebase = (window as any).firebase;
        if (!firebase) return;

        if (!firebase.apps.length) {
          firebase.initializeApp({
            apiKey:            "AIzaSyCcCVGSMA1nX5f2_jjG1pqkNSDRGduR_p0",
            authDomain:        "meal-reminder-app.firebaseapp.com",
            projectId:         "meal-reminder-app",
            storageBucket:     "meal-reminder-app.appspot.com",
            messagingSenderId: "1034543527787",
            appId:             "1:1034543527787:web:5e04ce5cf292072badbe2e",
          });
        }

        const messaging = firebase.messaging();
        messaging.onMessage((payload: any) => {
          console.log("[FCM] Foreground message:", payload);
          const title = payload.notification?.title ?? "Cranberry";
          const body  = payload.notification?.body  ?? "";
          toast(title, {
            description: body,
            duration:    6000,
            icon:        "🌿",
          });
        });

        console.log("[FCM] Foreground listener ready");
      } catch (err) {
        console.error("[FCM] Foreground setup error:", err);
      }
    }

    setupForegroundListener();
  }, []);
}

// ─── Components ───────────────────────────────────────────────────────────────

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { phone, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isLoginPage = location.pathname === "/login";

  useEffect(() => {
    if (isLoading) return;
    if (!phone && !isLoginPage) {
      navigate({ to: "/login" });
    }
  }, [isLoading, phone, isLoginPage, navigate]);

  if (isLoading) {
    return (
      <div className="phone-frame bg-background flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!phone && !isLoginPage) return null;
  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Listen for foreground FCM messages and show toast
  useForegroundNotifications();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGuard>
          <Outlet />
        </AuthGuard>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              background: "var(--card)",
              border:     "1px solid var(--border)",
              color:      "var(--foreground)",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
