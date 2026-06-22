/**
 * Google Apps Script — Migraine Minder
 *
 * Sheets:
 * - Users:             A:Mobile | B:FCM Token | C:Name | D:Day time | E:Night Time | F:Status | G:Day Combo | H:Night Combo
 * - Notification Logs: A:Phone  | B:FCM Token | C:Date | D:Time | E:Status
 * - Streak Logs:       A:Phone  | B:Date | C:Type | D:Supplement Name | E:Score
 */

const SHEET_ID         = "1DfV-C523LbzxNPpxNJYF4LljEMTZvjPPTHtc3jfG53A";
const USERS_SHEET      = "Users";
const NOTIF_LOG_SHEET  = "Notification Logs";
const STREAK_LOG_SHEET = "Streak Logs";

const COL = {
  MOBILE:      1,
  TOKEN:       2,
  NAME:        3,
  DAY_TIME:    4,
  NIGHT_TIME:  5,
  STATUS:      6,
  DAY_COMBO:   7,
  NIGHT_COMBO: 8,
  TOTAL:       8,
};

// ─── GET ──────────────────────────────────────────────────────────────────────
function doGet(e) {
  const action = e?.parameter?.action;
  if (action === "list") return respond({ ok: true, tokens: getActiveTokens() });

  if (action === "getUser") {
    const mobile = e?.parameter?.mobile ?? "";
    return respond(getUserByMobile(mobile));
  }
  const sheet = getSheet(USERS_SHEET);
  return respond({ ok: true, sheet: USERS_SHEET, totalRows: Math.max(0, sheet.getLastRow() - 1) });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // His original token registration
    if (data.mobile_number !== undefined || data.fcm_token !== undefined) {
      return handleTokenRegistration(data);
    }

    const { action, record } = data;
    switch (action) {
      case "upsert":      return respond({ ok: true, result: upsertToken(record) });
      case "deactivate":  return respond({ ok: true, result: deactivateToken(record.token) });
      case "delete":      return respond({ ok: true, result: deleteToken(record.token) });
      case "log":         return respond({ ok: true, result: logNotification(record) });
      case "logStreak":   return respond({ ok: true, result: upsertStreak(record) });
      case "updateCombo": return respond({ ok: true, result: updateCombo(record) });
      default:            return respond({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    Logger.log("doPost error: " + err);
    return respond({ error: String(err) }, 500);
  }
}

// ─── Token registration ───────────────────────────────────────────────────────
function handleTokenRegistration(data) {
  const sheet      = getSheet(USERS_SHEET);
  const mobile     = String(data.mobile_number || "").trim();
  const token      = String(data.fcm_token     || "").trim();
  const dayCombo   = String(data.day_combo     || "").trim();
  const nightCombo = String(data.night_combo   || "").trim();

  if (!mobile || !token) return createResponse(false, "Mobile number or token missing");

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === mobile) {
      sheet.getRange(i + 1, COL.TOKEN).setValue(token);
      sheet.getRange(i + 1, COL.STATUS).setValue("Active");
      if (dayCombo)   sheet.getRange(i + 1, COL.DAY_COMBO).setValue(dayCombo);
      if (nightCombo) sheet.getRange(i + 1, COL.NIGHT_COMBO).setValue(nightCombo);
      sheet.getRange(i + 1, 1, 1, COL.TOTAL).setBackground("#e8f5e9");
      return createResponse(true, "Token updated");
    }
  }

  sheet.appendRow([mobile, token, "", "", "", "Active", dayCombo, nightCombo]);
  sheet.getRange(sheet.getLastRow(), 1, 1, COL.TOTAL).setBackground("#e8f5e9");
  return createResponse(true, "New user added");
}

function upsertToken(record) {
  const sheet      = getSheet(USERS_SHEET);
  const mobile     = String(record.mobile     ?? "").trim();
  const token      = String(record.token      ?? "").trim();
  const dayCombo   = String(record.dayCombo   ?? "").trim();
  const nightCombo = String(record.nightCombo ?? "").trim();

  if (!token) return "error: missing token";

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === mobile) {
      sheet.getRange(i + 1, COL.TOKEN).setValue(token);
      sheet.getRange(i + 1, COL.STATUS).setValue("Active");
      if (dayCombo)   sheet.getRange(i + 1, COL.DAY_COMBO).setValue(dayCombo);
      if (nightCombo) sheet.getRange(i + 1, COL.NIGHT_COMBO).setValue(nightCombo);
      sheet.getRange(i + 1, 1, 1, COL.TOTAL).setBackground("#e8f5e9");
      return "updated";
    }
  }

  sheet.appendRow([mobile, token, "", "", "", "Active", dayCombo, nightCombo]);
  sheet.getRange(sheet.getLastRow(), 1, 1, COL.TOTAL).setBackground("#e8f5e9");
  return "inserted";
}

function deactivateToken(token) {
  const sheet = getSheet(USERS_SHEET);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.TOKEN - 1]).trim() === token) {
      sheet.getRange(i + 1, COL.STATUS).setValue("Inactive");
      sheet.getRange(i + 1, 1, 1, COL.TOTAL).setBackground("#ffebee");
      return "deactivated";
    }
  }
  return "not found";
}

function deleteToken(token) {
  const sheet = getSheet(USERS_SHEET);
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.TOKEN - 1]).trim() === token) {
      sheet.deleteRow(i + 1);
      return "deleted";
    }
  }
  return "not found";
}

function getActiveTokens() {
  const sheet  = getSheet(USERS_SHEET);
  const rows   = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const mobile     = String(rows[i][COL.MOBILE      - 1] ?? "").trim();
    const token      = String(rows[i][COL.TOKEN       - 1] ?? "").trim();
    const dayTime    = String(rows[i][COL.DAY_TIME    - 1] ?? "").trim();
    const nightTime  = String(rows[i][COL.NIGHT_TIME  - 1] ?? "").trim();
    const status     = String(rows[i][COL.STATUS      - 1] ?? "").trim().toLowerCase();
    const dayCombo   = String(rows[i][COL.DAY_COMBO   - 1] ?? "").trim();
    const nightCombo = String(rows[i][COL.NIGHT_COMBO - 1] ?? "").trim();

    if (token.length > 10 && (status === "active" || status === "")) {
      result.push({ mobile, token, dayTime, nightTime, dayCombo, nightCombo });
    }
  }
  return result;
}

// ─── Get user by mobile ───────────────────────────────────────────────────────
function getUserByMobile(mobile) {
  const sheet = getSheet(USERS_SHEET);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(mobile).trim()) {
      return {
        ok:        true,
        mobile:    String(rows[i][COL.MOBILE      - 1] ?? "").trim(),
        name:      String(rows[i][COL.NAME        - 1] ?? "").trim(),
        dayTime:   String(rows[i][COL.DAY_TIME    - 1] ?? "").trim(),
        nightTime: String(rows[i][COL.NIGHT_TIME  - 1] ?? "").trim(),
        dayCombo:  String(rows[i][COL.DAY_COMBO   - 1] ?? "").trim(),
        nightCombo:String(rows[i][COL.NIGHT_COMBO - 1] ?? "").trim(),
      };
    }
  }
  return { ok: false, name: "" };
}

// ─── Update combo only (no token needed) ─────────────────────────────────────
function updateCombo(record) {
  const sheet  = getSheet(USERS_SHEET);
  const mobile = String(record.mobile ?? "").trim();

  if (!mobile) return "error: missing mobile";

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === mobile) {
      if (record.dayCombo)   sheet.getRange(i + 1, COL.DAY_COMBO).setValue(record.dayCombo);
      if (record.nightCombo) sheet.getRange(i + 1, COL.NIGHT_COMBO).setValue(record.nightCombo);
      sheet.getRange(i + 1, 1, 1, COL.TOTAL).setBackground("#e8f5e9");
      Logger.log("Updated combo for " + mobile);
      return "combo updated";
    }
  }
  return "mobile not found";
}

// ─── Notification Log ─────────────────────────────────────────────────────────
function logNotification(record) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(NOTIF_LOG_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(NOTIF_LOG_SHEET);
    const headers = ["Phone", "FCM Token", "Date of Notification", "Notification Time", "Status"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
         .setBackground("#4a0e8f").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
    [140, 360, 180, 140, 100].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  }

  const now    = new Date();
  const date   = Utilities.formatDate(now, "Asia/Kolkata", "dd/MM/yyyy");
  const time   = record.time   ?? Utilities.formatDate(now, "Asia/Kolkata", "HH:mm");
  const status = record.status ?? "Sent";

  sheet.appendRow([record.mobile ?? "", record.token ?? "", date, time, status]);
  sheet.getRange(sheet.getLastRow(), 1, 1, 5)
       .setBackground(status === "Sent" ? "#e8f5e9" : "#ffebee");

  return "logged";
}

// ─── Streak Log — UPSERT with skip if same data ──────────────────────────────
function upsertStreak(record) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(STREAK_LOG_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(STREAK_LOG_SHEET);
    const headers = ["Phone", "Streak Log Date", "Streak Type", "Supplement Name", "Score"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
         .setBackground("#4a0e8f").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
    [140, 160, 120, 260, 100].forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  }

  const now   = new Date();
  const phone = String(record.phone  ?? record.mobile ?? "").trim();
  const date  = record.date ?? Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd");
  const type  = String(record.type   ?? "day").trim();
  const supp  = String(record.supplements ?? "").trim();
  const score = record.score ?? 0;

  // Find existing row with same phone + date + type
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    for (let i = 0; i < rows.length; i++) {
      const rowPhone = String(rows[i][0]).trim();
      const rowDate  = String(rows[i][1]).trim();
      const rowType  = String(rows[i][2]).trim();

      if (rowPhone === phone && rowDate === date && rowType === type) {
        // Check if data is same — if yes, skip
        const existingSupp  = String(rows[i][3]).trim();
        const existingScore = rows[i][4];

        if (existingSupp === supp && existingScore == score) {
          return "skipped - same data";
        }

        // Data is different → UPDATE
        const rowNum = i + 2;
        sheet.getRange(rowNum, 4).setValue(supp);
        sheet.getRange(rowNum, 5).setValue(score);
        sheet.getRange(rowNum, 1, 1, 5).setBackground("#e8f5e9");
        Logger.log("Updated streak row " + rowNum + " for " + phone);
        return "updated";
      }
    }
  }

  // INSERT new row
  sheet.appendRow([phone, date, type, supp, score]);
  sheet.getRange(sheet.getLastRow(), 1, 1, 5).setBackground("#e8f5e9");
  Logger.log("Inserted new streak row for " + phone);
  return "inserted";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function respond(data, _code) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function createResponse(success, message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success, message }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Tests ────────────────────────────────────────────────────────────────────
function testNotifLog() {
  logNotification({ mobile: "9207642847", token: "test-token", time: "08:00", status: "Sent" });
  Logger.log("✓ Notification log added");
}

function testStreakUpsert() {
  // First insert
  upsertStreak({ phone: "9207642847", date: "19/06/2026", type: "day", supplements: "Ribo", score: 1 });
  // Update same row
  upsertStreak({ phone: "9207642847", date: "19/06/2026", type: "day", supplements: "Ribo + Mg", score: 3 });
  Logger.log("✓ Streak upsert tested — should see ONE row with Ribo + Mg");
}
