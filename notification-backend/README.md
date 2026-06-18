# Migraine Minder — Notification Backend

Standalone Node.js server that:
- Receives FCM tokens from the app
- Saves them to Google Sheet
- Sends scheduled push notifications to each user at their personal meal times
- Auto-deactivates invalid/unregistered tokens

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in `.env`:
- `FIREBASE_PROJECT_ID` — `meal-reminder-app`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — paste your service account JSON (one line)
- `SHEET_WEBHOOK_URL` — your Google Apps Script Web App URL
- `API_SECRET` — any random string (e.g. `cran2024berry`)
- `UTC_OFFSET_HOURS` — `5.5` for IST (India)

### 3. Run
```bash
# Development (auto-restarts on file change)
npm run dev

# Production
npm start
```

---

## API Endpoints

### POST /register-token
Called automatically by the browser when a user enables notifications.
```json
{
  "token":     "FCM_TOKEN_HERE",
  "mobile":    "9876543210",
  "dayTime":   "08:00",
  "nightTime": "20:00"
}
```

### POST /send
Send to specific token(s). Requires `x-api-secret` header.
```json
{
  "tokens": ["FCM_TOKEN_1", "FCM_TOKEN_2"],
  "title":  "Morning supplements",
  "body":   "Time to take your dose."
}
```

### POST /send-all
Broadcast to ALL active tokens in the sheet. Requires `x-api-secret` header.
```json
{
  "title": "Morning supplements 🌿",
  "body":  "Time to take your morning dose."
}
```

### GET /health
Check if server is running and configured.

---

## Testing

```bash
# 1. Check tokens in your sheet
node test-send.js sheet

# 2. Send to first active token (direct FCM, no HTTP)
node test-send.js token

# 3. Send to all active tokens via HTTP (server must be running)
node test-send.js all
```

---

## How scheduling works

The scheduler runs **every minute**. For each active token it checks:
- Is `dayTime` within ±2 minutes of current time? → send morning/afternoon notification
- Is `nightTime` within ±2 minutes of current time? → send evening notification

So if a user has `dayTime = 08:00`, they get a notification at 8:00 AM (±2 min).
If another user has `dayTime = 09:00`, they get theirs at 9:00 AM.

Timezone is controlled by `UTC_OFFSET_HOURS` in `.env` (default: 5.5 = IST).

---

## File structure

```
notification-backend/
├── server.js      ← Express server + API routes
├── fcm.js         ← Firebase FCM sender (JWT auth + send)
├── sheet.js       ← Google Sheet read/write via Apps Script
├── scheduler.js   ← Cron job — fires notifications at meal times
├── test-send.js   ← Manual test script
├── package.json
├── .env.example
└── README.md
```

---

## Connecting to Lovable frontend

The Lovable app calls `/register-token` when a user enables notifications.
Update `firebase-messaging.ts` in Lovable to point to this server:

```ts
// In registerTokenWithBackend(), change the URL to:
await fetch("https://YOUR_SERVER_URL/register-token", { ... })
```

For local dev, use `http://localhost:3000/register-token`.
For production, deploy this server to Railway / Render / any VPS.
