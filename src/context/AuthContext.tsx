import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredPhone, storePhone, clearPhone, storeSession, getSession, clearSession } from '@/lib/auth';

interface AuthContextValue {
  phone: string | null;
  isLoading: boolean;
  login: (phone: string, token?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setPhone(session.phone);
    } else {
      setPhone(getStoredPhone());
    }
    setIsLoading(false);
  }, []);

  function login(p: string, token?: string) {
    if (token) storeSession(token);
    storePhone(p);
    setPhone(p);
  }

  function logout() {
    clearSession();
    clearPhone();
    setPhone(null);
  }

  return (
    <AuthContext.Provider value={{ phone, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
