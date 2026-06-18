/**
 * Google Apps Script — Migraine Minder FCM Token Manager
 *
 * Sheet: Users
 * Columns:
 *   A: Mobile Number
 *   B: FCM Token
 *   C: Name
 *   D: Day time
 *   E: Night Time
 *   F: Status
 *   G: Day Combo    ← NEW
 *   H: Night Combo  ← NEW
 *
 * Deploy as Web App → Execute as: Me → Who has access: Anyone
 */

const SHEET_ID   = "1DfV-C523LbzxNPpxNJYF4LljEMTZvjPPTHtc3jfG53A";
const SHEET_NAME = "Users";

// Column indices (1-based)
const COL = {
  MOBILE:      1,
  TOKEN:       2,
  NAME:        3,
  DAY_TIME:    4,
  NIGHT_TIME:  5,
  STATUS:      6,
  DAY_COMBO:   7,  // NEW
  NIGHT_COMBO: 8,  // NEW
  TOTAL:       8,
};

// ─── GET ──────────────────────────────────────────────────────────────────────
function doGet(e) {
  const action = e?.parameter?.action;

  if (action === "list") {
    return respond({ ok: true, tokens: getActiveTokens() });
  }

  const sheet = getSheet();
  const count = Math.max(0, sheet.getLastRow() - 1);
  return respond({ ok: true, sheet: SHEET_NAME, totalRows: count });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // His original token registration (mobile_number + fcm_token)
    if (data.mobile_number !== undefined || data.fcm_token !== undefined) {
      return handleTokenRegistration(data);
    }

    // Our action-based calls
    const { action, record } = data;
    switch (action) {
      case "upsert":     return respond({ ok: true, result: upsertToken(record) });
      case "deactivate": return respond({ ok: true, result: deactivateToken(record.token) });
      case "delete":     return respond({ ok: true, result: deleteToken(record.token) });
      default:           return respond({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    Logger.log("doPost error: " + err);
    return respond({ error: String(err) }, 500);
  }
}

// ─── His original registration logic — updated to save combo ─────────────────
function handleTokenRegistration(data) {
  const sheet      = getSheet();
  const mobile     = String(data.mobile_number || "").trim();
  const token      = String(data.fcm_token     || "").trim();
  const dayCombo   = String(data.day_combo     || "").trim();
  const nightCombo = String(data.night_combo   || "").trim();

  if (!mobile || !token) {
    return createResponse(false, "Mobile number or token missing");
  }

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

  // New row
  sheet.appendRow([mobile, token, "", "", "", "Active", dayCombo, nightCombo]);
  sheet.getRange(sheet.getLastRow(), 1, 1, COL.TOTAL).setBackground("#e8f5e9");
  return createResponse(true, "New user added");
}

// ─── Upsert from our backend ──────────────────────────────────────────────────
function upsertToken(record) {
  const sheet      = getSheet();
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
  const sheet = getSheet();
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
  const sheet = getSheet();
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][COL.TOKEN - 1]).trim() === token) {
      sheet.deleteRow(i + 1);
      return "deleted";
    }
  }
  return "not found";
}

// ─── Returns all active tokens for scheduler ──────────────────────────────────
function getActiveTokens() {
  const sheet  = getSheet();
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
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

// ─── Test ─────────────────────────────────────────────────────────────────────
function testAll() {
  const tokens = getActiveTokens();
  Logger.log("Active tokens: " + tokens.length);
  Logger.log(JSON.stringify(tokens, null, 2));
}
