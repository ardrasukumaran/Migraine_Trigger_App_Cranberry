// public/firebase-messaging-sw.js
// ⚠️  Replace the 3 REPLACE_ values with your Firebase web app config:
//     Firebase Console → Project Settings → General → Your apps → SDK setup

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "REPLACE_VITE_FIREBASE_API_KEY",
  authDomain:        "meal-reminder-app.firebaseapp.com",
  projectId:         "meal-reminder-app",
  storageBucket:     "meal-reminder-app.appspot.com",
  messagingSenderId: "REPLACE_VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId:             "REPLACE_VITE_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Background / terminated — show the notification
messaging.onBackgroundMessage((payload) => {
  const { title = "Cranberry", body = "", icon, data } = payload.notification ?? {};
  self.registration.showNotification(title, {
    body,
    icon:    icon ?? "/favicon.ico",
    badge:   "/favicon.ico",
    data:    { url: data?.url ?? "/coach", ...data },
    vibrate: [150, 80, 150],
    actions: [
      { action: "open",    title: "Log dose" },
      { action: "dismiss", title: "Dismiss"  },
    ],
  });
});

// Tap notification → open / focus app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const target = event.notification.data?.url ?? "/coach";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return clients.openWindow(target);
    })
  );
});
