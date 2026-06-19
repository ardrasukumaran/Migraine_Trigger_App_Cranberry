// public/firebase-messaging-sw.js
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            "AIzaSyCcCVGSMA1nX5f2_jjG1pqkNSDRGduR_p0",
  authDomain:        "meal-reminder-app.firebaseapp.com",
  projectId:         "meal-reminder-app",
  storageBucket:     "meal-reminder-app.appspot.com",
  messagingSenderId: "1034543527787",
  appId:             "1:1034543527787:web:5e04ce5cf292072badbe2e",
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  const { title = "Cranberry", body = "" } = payload.notification ?? {};

  // Get URL from notification data
  // Day → /coach?view=morning
  // Night → /coach?view=evening
  const url = payload.data?.url ?? payload.notification?.click_action ?? "/coach";

  self.registration.showNotification(title, {
    body,
    icon:    "/favicon.ico",
    badge:   "/favicon.ico",
    data:    { url },
    vibrate: [150, 80, 150],
    actions: [
      { action: "open",    title: "Log dose" },
      { action: "dismiss", title: "Dismiss"  },
    ],
  });
});

// Notification click → open correct page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  // Get the URL from notification data
  const target = event.notification.data?.url ?? "/coach";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // If app is already open → focus and navigate
      for (const client of list) {
        if ("focus" in client) {
          client.focus();
          client.navigate(target);
          return;
        }
      }
      // Otherwise open new window
      return clients.openWindow(target);
    })
  );
});
