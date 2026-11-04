import React, { createContext, useContext, useState, useEffect, useRef, PropsWithChildren } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { supabaseAuthService } from '../src/services/supabaseAuthService';
import { DEMO_AUTH_TOKEN_KEY, DEMO_AUTH_USER_KEY } from '../src/utils/api';
import { advanceApiSession, setApiSession } from '../src/utils/sessionState';

type AuthMode = 'supabase' | 'demo' | 'unknown';
type Recovery = { user: User; token: string | null; mode: AuthMode; schoolId: string | null };
const RECOVERY_KEY = 'smartschool_impersonation_recovery';
const demoAuthEnabled = import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true';
const isSeededDemoAccount = (email: string) => {
  const normalized = email.trim().toLowerCase();
  return normalized === 'creator@smartschool.edu' || normalized.endsWith('.demo');
};
const readRecovery = (): Recovery | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(RECOVERY_KEY) || 'null');
    return value?.user?.id && [UserRole.SUPER_ADMIN, UserRole.GROUP_OWNER].includes(value.user.role) ? value : null;
  } catch { return null; }
};
const clearLegacy = () => { localStorage.removeItem(DEMO_AUTH_TOKEN_KEY); localStorage.removeItem(DEMO_AUTH_USER_KEY); };
const persistLegacy = (user: User) => {
  if (!user.authToken) throw new Error('Missing session token.');
  localStorage.setItem(DEMO_AUTH_TOKEN_KEY, user.authToken);
  localStorage.setItem(DEMO_AUTH_USER_KEY, JSON.stringify(user));
};
const clearPrivateCache = () => {
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHES' });
  if (typeof caches !== 'undefined') void caches.keys().then(names => Promise.all(names.filter(n => n.startsWith('smartschool-')).map(n => caches.delete(n)))).catch(() => {});
};
interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
  loginStudent: (schoolCode: string, studentCode: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  impersonateSchool: (schoolId: string) => Promise<void>;
  stopImpersonating: () => void;
  isImpersonating: boolean;
  authMode: AuthMode;
  error: string | null;
  viewingSchoolId: string | null;
  setViewingSchoolId: (schoolId: string | null) => void;
  isCreator: boolean;
  isGroupOwner: boolean;
  effectiveSchoolId: string | null | undefined;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(readRecovery);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [viewingSchoolId, setViewingSchoolId] = useState<string | null>(null);
  const busy = useRef(false);
  const sequence = useRef(0);
  const userRef = useRef(user); userRef.current = user;
  const isCreator = user?.role === UserRole.SUPER_ADMIN;
  const isGroupOwner = user?.role === UserRole.GROUP_OWNER;
  const effectiveSchoolId = isCreator || isGroupOwner ? viewingSchoolId : user?.schoolId;
  setApiSession(user?.id, effectiveSchoolId || undefined);
  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      if (busy.current) return;
      const current = ++sequence.current;
      try {
        const token = localStorage.getItem(DEMO_AUTH_TOKEN_KEY);
        let next: User | null;
        if (token) {
          const res = await api.getCurrentUser();
          if (!res.ok) throw new Error(res.message || 'Your session has expired.');
          next = { ...res.data, authToken: token, provider: 'legacy' };
        } else next = await supabaseAuthService.getCurrentUser();
        if (!active || current !== sequence.current) return;
        setUser(next);
        setAuthMode(next ? next.provider === 'supabase' ? 'supabase' : 'demo' : 'unknown');
        if (token && next) persistLegacy(next);
        if (!token) { sessionStorage.removeItem(RECOVERY_KEY); setRecovery(null); }
      } catch (e: any) {
        if (!active || current !== sequence.current) return;
        clearLegacy(); sessionStorage.removeItem(RECOVERY_KEY); setRecovery(null); setUser(null);
        setError(e.message || 'Could not restore your session.');
      } finally { if (active && current === sequence.current) setIsLoading(false); }
    };
    void hydrate();
    const unsubscribe = supabaseAuthService.onAuthStateChanged(() => {
      if (localStorage.getItem(DEMO_AUTH_TOKEN_KEY) && userRef.current) return;
      setTimeout(() => { if (active) void hydrate(); }, 0);
    });
    const expired = () => {
      ++sequence.current; advanceApiSession(); clearLegacy(); clearPrivateCache();
      sessionStorage.removeItem(RECOVERY_KEY); setRecovery(null); setUser(null); setAuthMode('unknown'); setIsLoading(false);
      setError('Your session has expired. Please sign in again.');
    };
    window.addEventListener('auth:session-expired', expired);
    return () => { active = false; unsubscribe(); window.removeEventListener('auth:session-expired', expired); };
  }, []);
  const begin = () => { busy.current = true; ++sequence.current; advanceApiSession(); setIsLoading(true); setError(null); };
  const finish = () => { busy.current = false; setIsLoading(false); };
  const acceptLegacy = (next: User) => { const canonical = { ...next, provider: 'legacy' as const }; persistLegacy(canonical); setUser(canonical); setAuthMode('demo'); };
  const login = async (email: string, password?: string) => {
    begin(); clearLegacy(); sessionStorage.removeItem(RECOVERY_KEY); setRecovery(null); setUser(null); setViewingSchoolId(null);
    try {
      // Seeded pitch accounts live in the application database, not Supabase Auth.
      if (password && supabaseAuthService.isConfigured() && !isSeededDemoAccount(email)) {
        try { const next = await supabaseAuthService.login(email, password); setUser(next); setAuthMode('supabase'); return; }
        catch (e) { if (!demoAuthEnabled && !isSeededDemoAccount(email)) throw e; }
      }
      if (!demoAuthEnabled && !isSeededDemoAccount(email)) throw new Error('Sign in with your provisioned email and password.');
      const res = await api.login(email, password);
      if (!res.ok) throw new Error(res.message || 'Login failed.');
      acceptLegacy(res.data);
    } catch (e: any) { setError(e.message || 'Login failed.'); throw e; }
    finally { finish(); }
  };
  const loginStudent = async (schoolCode: string, studentCode: string) => {
    begin(); clearLegacy(); setUser(null); setRecovery(null); sessionStorage.removeItem(RECOVERY_KEY); setViewingSchoolId(null);
    try { const res = await api.verifyStudent(schoolCode, studentCode); if (!res.ok) throw new Error(res.message || 'Verification failed.'); acceptLegacy(res.data); }
    catch (e: any) { setError(e.message); throw e; } finally { finish(); }
  };
  const updateUser = (patch: Partial<User>) => {
    if (!user) return;
    const next = { ...user, ...patch };
    if (next.authToken) persistLegacy(next);
    setUser(next);
  };
  const impersonateSchool = async (schoolId: string) => {
    if (!user || recovery) throw new Error('Finish the current school session first.');
    begin();
    try {
      const res = await api.impersonateSchool(schoolId);
      if (!res.ok || !res.data.authToken) throw new Error(res.message || 'Could not enter this school.');
      const saved: Recovery = { user, token: localStorage.getItem(DEMO_AUTH_TOKEN_KEY), mode: authMode, schoolId: viewingSchoolId };
      sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(saved));
      persistLegacy({ ...res.data, provider: 'legacy' });
      clearPrivateCache(); setRecovery(saved); setUser({ ...res.data, provider: 'legacy' }); setAuthMode('demo'); setViewingSchoolId(null);
    } catch (e: any) { setError(e.message); throw e; } finally { finish(); }
  };
  const stopImpersonating = async () => {
    if (!recovery) return;
    begin();
    try {
      if (recovery.token) persistLegacy({ ...recovery.user, authToken: recovery.token }); else clearLegacy();
      const res = await api.getCurrentUser();
      if (!res.ok) throw new Error(res.message || 'The original session has expired.');
      const next = { ...res.data, ...(recovery.token ? { authToken: recovery.token } : {}), provider: recovery.mode === 'supabase' ? 'supabase' as const : 'legacy' as const };
      if (next.authToken) persistLegacy(next);
      setUser(next); setAuthMode(recovery.mode); setViewingSchoolId(recovery.schoolId); clearPrivateCache();
    } catch (e: any) { clearLegacy(); setUser(null); setError(e.message); }
    finally { sessionStorage.removeItem(RECOVERY_KEY); setRecovery(null); finish(); }
  };
  const logout = async () => {
    begin(); clearLegacy(); clearPrivateCache(); setUser(null); setRecovery(null); setViewingSchoolId(null); setAuthMode('unknown'); sessionStorage.removeItem(RECOVERY_KEY);
    try { await supabaseAuthService.logout(); } catch { /* Local session remains cleared. */ } finally { finish(); }
  };
  return <AuthContext.Provider value={{ user, login, loginStudent, logout, updateUser, isAuthenticated: !!user, isLoading, impersonateSchool, stopImpersonating, isImpersonating: !!recovery, authMode, error, viewingSchoolId, setViewingSchoolId, isCreator, isGroupOwner, effectiveSchoolId }}>{children}</AuthContext.Provider>;
};
export const useAuth = (): AuthContextType => { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within an AuthProvider'); return value; };
