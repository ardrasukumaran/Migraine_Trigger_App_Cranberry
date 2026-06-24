// onesignal.js — Send notifications via OneSignal REST API

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID ?? "9532e810-57ec-4019-b7c0-82a5eac1922b";
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

export async function sendViaOneSignal({ playerId, title, body, url }) {
  if (!ONESIGNAL_API_KEY) {
    console.error("[OneSignal] API key not set");
    return { success: false, error: "API key not set" };
  }

  try {
    const response = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Key ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id:                   ONESIGNAL_APP_ID,
        include_subscription_ids: [playerId],
        headings:                 { en: title },
        contents:                 { en: body },
        web_url:                  `https://test-app-cranberry.onrender.com${url}`,
        chrome_web_icon:          "https://test-app-cranberry.onrender.com/favicon.ico",
      }),
    });

    const data = await response.json();

    if (data.errors?.length > 0) {
      return { success: false, error: data.errors.join(", ") };
    }

    return { success: true, id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendToMany({ playerIds, tokens, title, body, url }) {
  const ids = playerIds ?? tokens ?? [];
  const results = await Promise.allSettled(
    ids.map(id => sendViaOneSignal({ playerId: id, title, body, url }))
  );

  const sent   = results.filter(r => r.status === "fulfilled" && r.value.success).length;
  const failed = results.length - sent;
  return { sent, failed, total: results.length };
}
