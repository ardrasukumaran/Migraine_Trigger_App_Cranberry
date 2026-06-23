const PHONE_KEY     = 'cranberry_phone';
const SESSION_KEY   = 'cranberry_session';
const USER_NAME_KEY = 'cranberry_user_name';

export function getStoredPhone(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PHONE_KEY);
}
export function storePhone(phone: string): void {
  localStorage.setItem(PHONE_KEY, phone);
}
export function clearPhone(): void {
  localStorage.removeItem(PHONE_KEY);
}

export function storeSession(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEY, token);
}

export function getSession(): { phone: string; exp: number } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;
  try {
    const [payload] = token.split('.');
    const json   = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as { phone: string; exp: number };
    if (parsed.exp < Date.now()) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

export function getUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_KEY);
}
export function storeUserName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_NAME_KEY, name);
}
export function clearUserName(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_NAME_KEY);
}
