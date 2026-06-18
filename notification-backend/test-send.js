// test-send.js — manual test runner
// Usage:
//   node test-send.js token    → send to a single hardcoded token
//   node test-send.js all      → send to ALL active tokens in sheet
//   node test-send.js sheet    → print all active tokens from sheet

import "dotenv/config";
import { sendToToken }   from "./fcm.js";
import { getActiveTokens } from "./sheet.js";

const BASE_URL = `http://localhost:${process.env.PORT ?? 3000}`;
const SECRET   = process.env.API_SECRET ?? "";

const mode = process.argv[2] ?? "token";

// ─── TEST: send to a single token ─────────────────────────────────────────────
async function testSingleToken() {
  console.log("\n── Test: single token send ──────────────────────────────");

  const tokens = await getActiveTokens();
  if (!tokens.length) {
    console.log("No active tokens in sheet. Register a token first.");
    return;
  }

  const first = tokens[0];
  console.log(`Sending to: ${first.mobile} (${first.token.slice(0,20)}…)`);

  const result = await sendToToken({
    token: first.token,
    title: "Test notification 🧪",
    body:  "This is a test from the notification backend.",
    url:   "/coach",
  });

  console.log("Result:", result);
}

// ─── TEST: send-all via HTTP ───────────────────────────────────────────────────
async function testSendAll() {
  console.log("\n── Test: send-all via HTTP ──────────────────────────────");

  const res = await fetch(`${BASE_URL}/send-all`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "x-api-secret":  SECRET,
    },
    body: JSON.stringify({
      title: "Morning supplements 🌿",
      body:  "Time to take your morning dose. Tap to log.",
    }),
  });

  const data = await res.json();
  console.log("Response:", JSON.stringify(data, null, 2));
}

// ─── TEST: print active tokens from sheet ─────────────────────────────────────
async function testSheet() {
  console.log("\n── Test: active tokens from Google Sheet ────────────────");
  const tokens = await getActiveTokens();
  if (!tokens.length) {
    console.log("No active tokens found.");
    return;
  }
  console.log(`Found ${tokens.length} active token(s):\n`);
  tokens.forEach((t, i) => {
    console.log(`  ${i + 1}. Mobile: ${t.mobile || "(no mobile)"}`);
    console.log(`     Token:  ${t.token?.slice(0, 30)}…`);
    console.log(`     Day:    ${t.dayTime}   Night: ${t.nightTime}`);
    console.log();
  });
}

// ─── Run ──────────────────────────────────────────────────────────────────────
if (mode === "token")   await testSingleToken();
else if (mode === "all") await testSendAll();
else if (mode === "sheet") await testSheet();
else {
  console.log("Usage: node test-send.js [token|all|sheet]");
}
