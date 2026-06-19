import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

import appCss from "../styles.css?url";

// ─── Foreground notification handler ─────────────────────────────────────────
function useForegroundNotifications() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    // Load Firebase from CDN and listen for foreground messages
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
        s.onerror = () => resolve(); // fail silently
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

        // Listen for foreground messages
        messaging.onMessage((payload: any) => {
          console.log("[FCM] Foreground message:", payload);
          const title = payload.notification?.title ?? "Cranberry";
          const body  = payload.notification?.body  ?? "";

          // Show toast notification inside the app
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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Migraine App Demo" },
      { name: "description", content: "Migraine Minder helps users track migraine triggers, log attacks, and build healthy habits." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Migraine App Demo" },
      { property: "og:description", content: "Migraine Minder helps users track migraine triggers, log attacks, and build healthy habits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Migraine App Demo" },
      { name: "twitter:description", content: "Migraine Minder helps users track migraine triggers, log attacks, and build healthy habits." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4f1253b3-23f5-4f66-a4ad-840dd4db68a0/id-preview-2a3f66c7--06a1a847-01a7-4830-a0f6-55a601d4ae65.lovable.app-1781363945395.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4f1253b3-23f5-4f66-a4ad-840dd4db68a0/id-preview-2a3f66c7--06a1a847-01a7-4830-a0f6-55a601d4ae65.lovable.app-1781363945395.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Listen for foreground FCM messages and show toast
  useForegroundNotifications();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
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
    </QueryClientProvider>
  );
}
