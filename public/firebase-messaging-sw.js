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

const BASE_URL = "https://test-app-cranberry.onrender.com";

// Background message handler — only shows notification when app is CLOSED
messaging.onBackgroundMessage((payload) => {
  const { title = "Cranberry", body = "" } = payload.notification ?? {};
  const url = payload.data?.url ?? "/coach";

  // Check if app is already open — if yes, skip system notification
  // (foreground handler in __root.tsx will show toast instead)
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
    const appOpen = clientList.some(c => c.url.includes(BASE_URL));
    if (appOpen) return; // app is open → don't show system notification

    // App is closed → show system notification
    self.registration.showNotification(title, {
      body,
      icon:    "/favicon.ico",
      badge:   "/favicon.ico",
      data:    { url },
      vibrate: [150, 80, 150],
    });
  });
});

// Notification click → open correct page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/coach";
  const fullUrl = BASE_URL + url;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open → post message to navigate
      for (const client of clientList) {
        if (client.url.includes(BASE_URL)) {
          client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", url });
          return;
        }
      }
      // App is closed → open new window
      return self.clients.openWindow(fullUrl);
    })
  );
});
