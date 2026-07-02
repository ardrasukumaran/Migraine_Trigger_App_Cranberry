import type { AttackLog } from './storage';

const WEBHOOK_URL: string =
  (import.meta.env.VITE_WEBHOOK_URL as string | undefined) ||
  'https://hook.us1.make.com/q4fab39gtd9bxg16x8ms5r0rbn6soho9';

export interface WebhookPayload {
  phone: string;
  date: string;
  intensity: number;
  status: string;
  duration: string;
  foods: string;         // comma-separated food triggers
  otherTriggers: string; // comma-separated non-food triggers
  others: string;
  loggedAt: string;      // ISO timestamp
}

export function sendAttackToWebhook(attack: AttackLog, phone: string): void {
  const digits = phone.replace(/\D/g, "").slice(-10);
  const payload: WebhookPayload = {
    phone: `+91${digits}`,
    date: attack.date,
    intensity: attack.intensity,
    status: attack.status,
    duration: attack.duration,
    foods: attack.foods.join(', '),
    otherTriggers: (attack.nonFoodTriggers ?? []).join(', '),
    others: attack.others ?? '',
    loggedAt: new Date(attack.createdAt).toISOString(),
  };

  // Fire-and-forget — don't block the UI or surface errors to the user
  fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore network failures; data is still saved locally
  });
}
