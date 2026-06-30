// sheet.js — Direct Google Sheets API integration (no Apps Script middleman)
// Replaces the old Apps Script webhook approach for 100% reliability

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? "1DfV-C523LbzxNPpxNJYF4LljEMTZvjPPTHtc3jfG53A";

const USERS_SHEET      = "Users";
const NOTIF_LOG_SHEET  = "Notification Logs";
const STREAK_LOG_SHEET = "Streak Logs";

// Column indices (0-based for API, but we keep 1-based references in comments)
// Users: A:Mobile B:Token C:Name D:DayTime E:NightTime F:Status G:DayCombo H:NightCombo
const COL = {
  MOBILE: 0, TOKEN: 1, NAME: 2, DAY_TIME: 3, NIGHT_TIME: 4,
  STATUS: 5, DAY_COMBO: 6, NIGHT_COMBO: 7,
};

// ─── Auth setup ────────────────────────────────────────────────────────────────
let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const credsJson = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON;
  if (!credsJson) throw new Error("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON not set");

  const credentials = JSON.parse(credsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: "v4", auth: authClient });
  return sheetsClient;
}

// ─── Helper: retry wrapper for API calls ─────────────────────────────────────
async function withRetry(fn, label, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`[Sheets] ${label} attempt ${i + 1} failed:`, err.message);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// ─── Ensure a sheet tab exists, create with headers if not ──────────────────
async function ensureSheetExists(sheets, sheetName, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === sheetName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

// ─── Get active tokens for scheduler ─────────────────────────────────────────
export async function getActiveTokens() {
  return withRetry(async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:H`,
    });

    const rows = res.data.values ?? [];
    const result = [];

    for (const row of rows) {
      const mobile     = String(row[COL.MOBILE]      ?? "").trim();
      const token      = String(row[COL.TOKEN]       ?? "").trim();
      const dayTime    = String(row[COL.DAY_TIME]    ?? "").trim();
      const nightTime  = String(row[COL.NIGHT_TIME]  ?? "").trim();
      const status     = String(row[COL.STATUS]      ?? "").trim().toLowerCase();
      const dayCombo   = String(row[COL.DAY_COMBO]   ?? "").trim();
      const nightCombo = String(row[COL.NIGHT_COMBO] ?? "").trim();

      if (token.length > 10 && (status === "active" || status === "")) {
        result.push({ mobile, token, dayTime, nightTime, dayCombo, nightCombo });
      }
    }
    return result;
  }, "getActiveTokens");
}

// ─── Upsert token (register / update user) ───────────────────────────────────
export async function upsertToken({ token, mobile, dayCombo, nightCombo }) {
  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, USERS_SHEET,
      ["Mobile Number", "FCM Token", "Name", "Day time", "Night Time", "Status", "Day Combo", "Night Combo"]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:A`,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.findIndex(r => String(r[0]).trim() === mobile);

    if (rowIndex !== -1) {
      // Update existing row
      const rowNum = rowIndex + 2; // +2 because data starts at row 2
      const updates = [
        { range: `${USERS_SHEET}!B${rowNum}`, values: [[token]] },
        { range: `${USERS_SHEET}!F${rowNum}`, values: [["Active"]] },
      ];
      if (dayCombo)   updates.push({ range: `${USERS_SHEET}!G${rowNum}`, values: [[dayCombo]] });
      if (nightCombo) updates.push({ range: `${USERS_SHEET}!H${rowNum}`, values: [[nightCombo]] });

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data: updates },
      });
      return "updated";
    } else {
      // Insert new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[mobile, token, "", "", "", "Active", dayCombo ?? "", nightCombo ?? ""]] },
      });
      return "inserted";
    }
  }, "upsertToken");
}

// ─── Update combo only (insert row if user doesn't exist) ────────────────────
export async function updateCombo({ mobile, dayCombo, nightCombo }) {
  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, USERS_SHEET,
      ["Mobile Number", "FCM Token", "Name", "Day time", "Night Time", "Status", "Day Combo", "Night Combo"]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:A`,
    });
    const rows = res.data.values ?? [];
    const rowIndex = rows.findIndex(r => String(r[0]).trim() === mobile);

    if (rowIndex !== -1) {
      const rowNum = rowIndex + 2;
      const updates = [];
      if (dayCombo)   updates.push({ range: `${USERS_SHEET}!G${rowNum}`, values: [[dayCombo]] });
      if (nightCombo) updates.push({ range: `${USERS_SHEET}!H${rowNum}`, values: [[nightCombo]] });
      if (updates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: { valueInputOption: "RAW", data: updates },
        });
      }
      return "combo updated";
    } else {
      // User doesn't exist yet — create new row with combo data (no token)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[mobile, "", "", "", "", "Active", dayCombo ?? "", nightCombo ?? ""]] },
      });
      return "inserted with combo";
    }
  }, "updateCombo");
}

// ─── Get user by mobile (for /user-info endpoint) ────────────────────────────
export async function getUserByMobile(mobile) {
  return withRetry(async () => {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:H`,
    });
    const rows = res.data.values ?? [];
    const row = rows.find(r => String(r[0]).trim() === String(mobile).trim());

    if (!row) return { ok: false, name: "" };

    return {
      ok:         true,
      mobile:     String(row[COL.MOBILE]      ?? "").trim(),
      name:       String(row[COL.NAME]        ?? "").trim(),
      dayTime:    String(row[COL.DAY_TIME]    ?? "").trim(),
      nightTime:  String(row[COL.NIGHT_TIME]  ?? "").trim(),
      dayCombo:   String(row[COL.DAY_COMBO]   ?? "").trim(),
      nightCombo: String(row[COL.NIGHT_COMBO] ?? "").trim(),
    };
  }, "getUserByMobile");
}

// ─── Log notification (batch-friendly, but works for single too) ────────────
export async function logNotification({ mobile, token, time, status }) {
  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, NOTIF_LOG_SHEET,
      ["Phone", "FCM Token", "Date of Notification", "Notification Time", "Status"]);

    const now  = new Date();
    const date = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }); // dd/mm/yyyy

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIF_LOG_SHEET}!A:E`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[mobile ?? "", token ?? "", date, time ?? "", status ?? "Sent"]] },
    });
    return "logged";
  }, "logNotification");
}

// ─── Batch log notifications — for scheduler sending to many users at once ──
export async function batchLogNotifications(entries) {
  // entries: [{ mobile, token, time, status }, ...]
  if (!entries.length) return;

  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, NOTIF_LOG_SHEET,
      ["Phone", "FCM Token", "Date of Notification", "Notification Time", "Status"]);

    const now  = new Date();
    const date = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" });

    const values = entries.map(e => [e.mobile ?? "", e.token ?? "", date, e.time ?? "", e.status ?? "Sent"]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIF_LOG_SHEET}!A:E`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    return `logged ${entries.length} entries`;
  }, "batchLogNotifications");
}

// ─── Streak log — UPSERT per supplement (phone+date+type+supplement) ────────
export async function upsertStreak({ phone, date, type, supplements, score }) {
  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, STREAK_LOG_SHEET,
      ["Phone", "Streak Log Date", "Streak Type", "Supplement Name", "Score"]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${STREAK_LOG_SHEET}!A2:E`,
    });
    const rows = res.data.values ?? [];

    const finalDate = date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // yyyy-mm-dd

    const rowIndex = rows.findIndex(r =>
      String(r[0]).trim() === String(phone).trim() &&
      String(r[1]).trim() === String(finalDate).trim() &&
      String(r[2]).trim() === String(type).trim() &&
      String(r[3]).trim() === String(supplements).trim()
    );

    if (rowIndex !== -1) {
      const existingScore = rows[rowIndex][4];
      if (String(existingScore) === String(score)) return "skipped - same data";

      const rowNum = rowIndex + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STREAK_LOG_SHEET}!E${rowNum}`,
        valueInputOption: "RAW",
        requestBody: { values: [[score]] },
      });
      return "updated";
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STREAK_LOG_SHEET}!A:E`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [[phone, finalDate, type, supplements, score]] },
      });
      return "inserted";
    }
  }, "upsertStreak");
}

// ─── Batch update combo — for many users saving combo at same time ──────────
export async function batchUpdateCombo(entries) {
  // entries: [{ mobile, dayCombo, nightCombo }, ...]
  if (!entries.length) return "0 entries";

  // Dedupe by mobile — keep last write for each user
  const dedupMap = new Map();
  for (const e of entries) dedupMap.set(e.mobile, e);
  const dedupedEntries = Array.from(dedupMap.values());

  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, USERS_SHEET,
      ["Mobile Number", "FCM Token", "Name", "Day time", "Night Time", "Status", "Day Combo", "Night Combo"]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:A`,
    });
    const rows = res.data.values ?? [];

    const updates = [];
    const toInsert = [];

    for (const e of dedupedEntries) {
      const rowIndex = rows.findIndex(r => String(r[0]).trim() === String(e.mobile).trim());
      if (rowIndex !== -1) {
        const rowNum = rowIndex + 2;
        if (e.dayCombo)   updates.push({ range: `${USERS_SHEET}!G${rowNum}`, values: [[e.dayCombo]] });
        if (e.nightCombo) updates.push({ range: `${USERS_SHEET}!H${rowNum}`, values: [[e.nightCombo]] });
      } else {
        toInsert.push([e.mobile, "", "", "", "", "Active", e.dayCombo ?? "", e.nightCombo ?? ""]);
      }
    }

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: "RAW", data: updates },
      });
    }

    if (toInsert.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A:H`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: toInsert },
      });
    }

    return `updated ${updates.length / 2 || 0} rows, inserted ${toInsert.length}`;
  }, "batchUpdateCombo");
}

// ─── Batch streak upsert — for saving multiple supplements at once ──────────
export async function batchUpsertStreak(entries) {
  // entries: [{ phone, date, type, supplements, score }, ...]
  if (!entries.length) return;

  // Dedupe WITHIN the batch first — keep only the LAST entry for each unique key
  // (handles case where same user sends multiple updates within the 2-sec queue window)
  const dedupMap = new Map();
  for (const e of entries) {
    const finalDate = e.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const key = `${e.phone}|${finalDate}|${e.type}|${e.supplements}`;
    dedupMap.set(key, { ...e, date: finalDate }); // last write wins
  }
  const dedupedEntries = Array.from(dedupMap.values());

  return withRetry(async () => {
    const sheets = await getSheetsClient();
    await ensureSheetExists(sheets, STREAK_LOG_SHEET,
      ["Phone", "Streak Log Date", "Streak Type", "Supplement Name", "Score"]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${STREAK_LOG_SHEET}!A2:E`,
    });
    const rows = res.data.values ?? [];

    const toInsert = [];
    const toUpdate = []; // { rowNum, score }

    for (const e of dedupedEntries) {
      const finalDate = e.date;
      const rowIndex = rows.findIndex(r =>
        String(r[0]).trim() === String(e.phone).trim() &&
        String(r[1]).trim() === String(finalDate).trim() &&
        String(r[2]).trim() === String(e.type).trim() &&
        String(r[3]).trim() === String(e.supplements).trim()
      );

      if (rowIndex !== -1) {
        const existingScore = rows[rowIndex][4];
        if (String(existingScore) !== String(e.score)) {
          toUpdate.push({ rowNum: rowIndex + 2, score: e.score });
        }
      } else {
        toInsert.push([e.phone, finalDate, e.type, e.supplements, e.score]);
      }
    }

    if (toInsert.length) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${STREAK_LOG_SHEET}!A:E`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: toInsert },
      });
    }

    if (toUpdate.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: toUpdate.map(u => ({
            range: `${STREAK_LOG_SHEET}!E${u.rowNum}`,
            values: [[u.score]],
          })),
        },
      });
    }

    return `inserted ${toInsert.length}, updated ${toUpdate.length}`;
  }, "batchUpsertStreak");
}
