import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api, get, post, tokenStore } from '../lib/api';
import type { User } from '../lib/types';

interface AuthApi {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) { setLoading(false); return; }
    get<User>('/auth/me').then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await post<{ token: string; user: User }>('/auth/login', { email, password });
    tokenStore.set(data.token);
    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    delete api.defaults.headers.common.Authorization;
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
