// test-send.js — manual test runner
// Usage:
//   node test-send.js sheet    → print all active tokens from sheet
//   node test-send.js token    → send to first REAL token from sheet
//   node test-send.js all      → send to ALL active tokens

import "dotenv/config";
import { sendToToken, sendToMany } from "./fcm.js";
import { getActiveTokens }         from "./sheet.js";

const mode = process.argv[2] ?? "token";

// ─── TEST: print all tokens ───────────────────────────────────────────────────
async function testSheet() {
  console.log("\n── Test: active tokens from Google Sheet ────────────────");
  const tokens = await getActiveTokens();
  if (!tokens.length) { console.log("No active tokens found."); return; }
  console.log(`Found ${tokens.length} active token(s):\n`);
  tokens.forEach((t, i) => {
    console.log(`  ${i + 1}. Mobile:     ${t.mobile || "(no mobile)"}`);
    console.log(`     Token:      ${t.token?.slice(0, 30)}…`);
    console.log(`     Day:        ${t.dayTime}   Night: ${t.nightTime}`);
    console.log(`     Day Combo:  ${t.dayCombo  || "(empty)"}`);
    console.log(`     Night Combo:${t.nightCombo || "(empty)"}`);
    console.log();
  });
}

// ─── TEST: send to first real token ──────────────────────────────────────────
async function testSingleToken() {
  console.log("\n── Test: send to first real token ───────────────────────");
  const tokens = await getActiveTokens();

  // Skip fake test tokens — find first real FCM token
  const real = tokens.find(t => !t.token.startsWith("test-"));

  if (!real) {
    console.log("No real FCM tokens found. Only test tokens in sheet.");
    return;
  }

  console.log(`Sending to: ${real.mobile} (${real.token.slice(0, 30)}…)`);
  console.log(`Day combo:  ${real.dayCombo}`);
  console.log(`Night combo: ${real.nightCombo}`);

  const result = await sendToToken({
    token: real.token,
    title: "Cranberry · Test notification 🌿",
    body:  "This is a test. Your notification backend is working!",
    url:   "/coach",
  });

  console.log("\nResult:", result);

  if (result.success) {
    console.log("\n✅ Notification sent! Check your phone/browser.");
  } else {
    console.log("\n❌ Failed:", result.error);
  }
}

// ─── TEST: send to all tokens ─────────────────────────────────────────────────
async function testSendAll() {
  console.log("\n── Test: send to ALL active tokens ──────────────────────");
  const tokens  = await getActiveTokens();
  const real    = tokens.filter(t => !t.token.startsWith("test-"));

  if (!real.length) { console.log("No real tokens found."); return; }

  console.log(`Sending to ${real.length} token(s)…`);

  const results = await Promise.allSettled(
    real.map(t => sendToToken({
      token: t.token,
      title: "Cranberry · Test broadcast 🌿",
      body:  "Broadcast test from notification backend.",
      url:   "/coach",
    }))
  );

  results.forEach((r, i) => {
    const status = r.status === "fulfilled" && r.value.success ? "✅" : "❌";
    console.log(`${status} ${real[i].mobile}`);
  });
}

// ─── Run ──────────────────────────────────────────────────────────────────────
if      (mode === "sheet") await testSheet();
else if (mode === "token") await testSingleToken();
else if (mode === "all")   await testSendAll();
else console.log("Usage: node test-send.js [sheet|token|all]");
