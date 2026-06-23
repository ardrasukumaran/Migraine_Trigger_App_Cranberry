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

// ─── OneSignal foreground notification handler ────────────────────────────────
function useForegroundNotifications() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Listen for notification click from service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "NOTIFICATION_CLICK" && event.data?.url) {
          window.location.href = event.data.url;
        }
      });
    }

    // OneSignal foreground notification handler
    const checkOneSignal = setInterval(() => {
      const OneSignal = (window as any).OneSignal;
      if (!OneSignal) return;
      clearInterval(checkOneSignal);

      OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
        // Show toast instead of system notification when app is open
        const title = event.notification.title ?? "Cranberry";
        const body  = event.notification.body  ?? "";
        toast(title, { description: body, duration: 6000, icon: "🌿" });
        // Prevent system notification when app is open
        event.preventDefault();
        console.log("[OneSignal] Foreground notification:", title);
      });

      console.log("[OneSignal] Foreground listener ready");
    }, 1000);

    return () => clearInterval(checkOneSignal);
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
