import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStoredPhone, storePhone, clearPhone, storeSession, getSession, clearSession, getUserName, storeUserName, clearUserName } from '@/lib/auth';

interface AuthContextValue {
  phone: string | null;
  userName: string;
  isLoading: boolean;
  login: (phone: string, token?: string, userName?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (import.meta.env.DEV) {
      setPhone("9999999999");
      setUserName("Dev");
      setIsLoading(false);
      return;
    }
    const session = getSession();
    if (session) {
      setPhone(session.phone);
    } else {
      setPhone(getStoredPhone());
    }
    setUserName(getUserName() ?? "");
    setIsLoading(false);
  }, []);

  function login(p: string, token?: string, name?: string) {
    if (token) storeSession(token);
    storePhone(p);
    setPhone(p);
    if (name) {
      storeUserName(name);
      setUserName(name);
    }
  }

  function logout() {
    clearSession();
    clearPhone();
    clearUserName();
    setPhone(null);
    setUserName("");
  }

  return (
    <AuthContext.Provider value={{ phone, userName, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
