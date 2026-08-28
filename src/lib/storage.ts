import { sendAttackToWebhook } from './webhook';
import { getStoredPhone } from './auth';

export interface AttackLog {
  id: string;
  date: string;       // ISO date string e.g. "2025-05-14"
  intensity: number;  // 1–10
  status: string;     // "Just started" | "Ongoing" | "Done"
  duration: string;   // "3–6h" | "6h" | ">6h" | "24h"
  foods: string[];          // selected food names
  nonFoodTriggers: string[]; // selected non-food trigger names
  others?: string;          // free-text notes
  painkillerTaken: boolean;
  painkillerCount: number | null;
  painkillerName: string | null;
  createdAt: number;        // timestamp for sorting
}

export const ATTACKS_KEY = 'cranberry_attacks_v2';

export function getAttacks(): AttackLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ATTACKS_KEY);
    return raw ? (JSON.parse(raw) as AttackLog[]) : [];
  } catch {
    return [];
  }
}

export function saveAttack(
  data: Omit<AttackLog, 'id' | 'createdAt'>,
): AttackLog {
  const attacks = getAttacks();
  const entry: AttackLog = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  attacks.unshift(entry);
  localStorage.setItem(ATTACKS_KEY, JSON.stringify(attacks));

  // Forward to webhook (no-op if VITE_WEBHOOK_URL is not set)
  sendAttackToWebhook(entry, getStoredPhone() ?? 'unknown');

  return entry;
}

export function deleteAttack(id: string): void {
  const attacks = getAttacks().filter((a) => a.id !== id);
  localStorage.setItem(ATTACKS_KEY, JSON.stringify(attacks));
}

/** Format a stored ISO date string for display e.g. "Wed, May 14" */
export function formatAttackDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
