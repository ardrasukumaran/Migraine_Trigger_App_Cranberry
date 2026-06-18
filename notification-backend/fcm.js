// fcm.js — Firebase FCM HTTP v1 sender
// Uses Web Crypto API (Node 18+) — no firebase-admin dependency needed

import { createSign } from "crypto";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

// ─── Get OAuth2 access token using service account JWT ────────────────────────
let _cachedToken = null;
let _tokenExpiry = 0;

export async function getAccessToken() {
  // Return cached token if still valid (with 5 min buffer)
  if (_cachedToken && Date.now() < _tokenExpiry - 300_000) {
    return _cachedToken;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not set");

  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT
  const header  = toBase64URL(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64URL(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  }));

  const unsigned = `${header}.${payload}`;

  // Sign with RSA private key (Node crypto)
  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  const sig = sign
    .sign(sa.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${sig}`;

  // Exchange JWT for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 token exchange failed: ${err}`);
  }

  const { access_token, expires_in } = await res.json();
  _cachedToken = access_token;
  _tokenExpiry = Date.now() + (expires_in * 1000);

  console.log("[FCM] Access token refreshed");
  return access_token;
}

// ─── Send one FCM message to a single token ───────────────────────────────────
export async function sendToToken({ token, title, body, url = "/coach", data = {} }) {
  const accessToken = await getAccessToken();

  const message = {
    token,
    notification: { title, body },
    webpush: {
      headers: { Urgency: "high" },
      notification: {
        title,
        body,
        icon:  "/favicon.ico",
        badge: "/favicon.ico",
        data:  { url },
      },
      fcm_options: { link: url },
    },
    data: { url, ...data },
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return { success: false, token: token.slice(0, 20) + "…", error: err };
  }

  const { name } = await res.json();
  return { success: true, token: token.slice(0, 20) + "…", messageId: name };
}

// ─── Send to multiple tokens (batched, 10 at a time) ─────────────────────────
export async function sendToMany({ tokens, title, body, url = "/coach", data = {} }) {
  const results = [];
  const BATCH   = 10;

  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch   = tokens.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((token) => sendToToken({ token, title, body, url, data }))
    );
    for (const r of settled) {
      results.push(r.status === "fulfilled" ? r.value : { success: false, error: String(r.reason) });
    }
  }

  return {
    sent:    results.filter((r) => r.success).length,
    failed:  results.filter((r) => !r.success).length,
    total:   tokens.length,
    results,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function toBase64URL(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
