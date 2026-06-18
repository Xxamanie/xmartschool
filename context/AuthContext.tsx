import React, { createContext, useContext, useState, useEffect, useRef, PropsWithChildren } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { supabaseAuthService } from '../src/services/supabaseAuthService';
import { DEMO_AUTH_TOKEN_KEY, DEMO_AUTH_USER_KEY } from '../src/utils/api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const isDemoForced = import.meta.env.VITE_ENABLE_DEMO_AUTH === 'true';

const demoAuthEnabled = isDemoForced || !(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your-project-ref.supabase.co');

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
  authMode: 'supabase' | 'demo' | 'unknown';
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
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'supabase' | 'demo' | 'unknown'>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [viewingSchoolId, setViewingSchoolId] = useState<string | null>(null);

  // Tracks an in-progress explicit logout so the auth listener
  // does not restore a demo session after Supabase fires SIGNED_OUT.
  const loggingOutRef = useRef(false);

  // Holds the super-admin's own auth token while impersonating, so it can be
  // restored on exit. null means "no demo token — fall back to Supabase".
  const originalTokenRef = useRef<string | null>(null);

  const isCreator = user?.role === UserRole.SUPER_ADMIN;
  const isGroupOwner = user?.role === UserRole.GROUP_OWNER;
  const effectiveSchoolId = isCreator || isGroupOwner ? viewingSchoolId : user?.schoolId;

  const persistDemoSession = (nextUser: User) => {
    if (nextUser.authToken) {
      window.localStorage.setItem(DEMO_AUTH_TOKEN_KEY, nextUser.authToken);
    }
    window.localStorage.setItem(DEMO_AUTH_USER_KEY, JSON.stringify(nextUser));
  };

  const clearDemoSession = () => {
    window.localStorage.removeItem(DEMO_AUTH_TOKEN_KEY);
    window.localStorage.removeItem(DEMO_AUTH_USER_KEY);
  };

  const restoreDemoSession = (): User | null => {
    const storedToken = window.localStorage.getItem(DEMO_AUTH_TOKEN_KEY);
    const storedUser = window.localStorage.getItem(DEMO_AUTH_USER_KEY);
    if (!storedToken || !storedUser) return null;
    try {
      return JSON.parse(storedUser) as User;
    } catch {
      clearDemoSession();
      return null;
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initAuth = () => {
      setError(null);

      const isSupabaseConfigured =
        supabaseAuthService.isConfigured() && supabaseUrl !== 'your-project-ref.supabase.co';

      if (isSupabaseConfigured) {
        setAuthMode('supabase');

        // Register listener FIRST.
        // Supabase fires the INITIAL_SESSION event synchronously on the next
        // microtask — before any await in this function — so isLoading is only
        // released inside the callback, preventing a flash of unauthenticated state.
        unsubscribe = supabaseAuthService.onAuthStateChanged((supabaseUser) => {
          if (loggingOutRef.current) {
            // Explicit logout in progress — don't restore anything.
            setUser(null);
            setIsLoading(false);
            return;
          }

          if (supabaseUser) {
            // Confirmed Supabase session — discard any stale demo tokens.
            clearDemoSession();
            setUser(supabaseUser);
            setAuthMode('supabase');
          } else {
            // No Supabase session — fall back to a stored demo/legacy session
            // so users who authenticated via the backend (students, demo admins)
            // survive a page refresh.
            const demoUser = restoreDemoSession();
            if (demoUser) {
              setUser(demoUser);
              // Supabase IS configured — keep authMode as 'supabase' so the
              // banner is accurate and the next login still tries Supabase first.
            } else {
              setUser(null);
            }
          }
          setIsLoading(false);
        });

        // Return here — setIsLoading(false) is owned by the listener above.
        // Do NOT fall through to the synchronous finally block below.
        return;
      }

      // ── Demo / no-Supabase path ───────────────────────────────────────────
      try {
        if (demoAuthEnabled) {
          setAuthMode('demo');
          const demoUser = restoreDemoSession();
          setUser(demoUser);
        } else {
          clearDemoSession();
          setUser(null);
          setAuthMode('unknown');
          setError('Supabase authentication is not configured.');
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err);
        setError('Failed to initialize authentication');
        setAuthMode(demoAuthEnabled ? 'demo' : 'unknown');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const handleSessionExpired = () => {
      clearDemoSession();
      setUser(null);
      setIsLoading(false);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check Supabase availability directly so a stale authMode state
      // doesn't prevent Supabase from being tried on subsequent logins.
      const isSupabaseAvailable =
        supabaseAuthService.isConfigured() && supabaseUrl !== 'your-project-ref.supabase.co';

      if (password && isSupabaseAvailable) {
        try {
          const supabaseUser = await supabaseAuthService.login(email, password);
          setUser(supabaseUser);
          setAuthMode('supabase');
          return;
        } catch (supabaseError: any) {
          if (!demoAuthEnabled) {
            throw new Error(supabaseError.message || 'Invalid email or password');
          }
          // demoAuthEnabled: fall through to API login without touching authMode
          console.warn('Supabase login failed, trying API login:', supabaseError.message);
        }
      }

      if (!demoAuthEnabled) {
        throw new Error('Demo authentication is disabled for this environment.');
      }

      const response = await api.login(email, password);
      if (response.ok) {
        persistDemoSession(response.data);
        setUser(response.data);
        // Only mark demo mode when Supabase is genuinely absent
        if (!isSupabaseAvailable) {
          setAuthMode('demo');
        }
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginStudent = async (schoolCode: string, studentCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.verifyStudent(schoolCode, studentCode);
      if (response.ok) {
        persistDemoSession(response.data);
        setUser(response.data);
        setAuthMode('demo');
      } else {
        throw new Error(response.message || 'Verification failed');
      }
    } catch (error: any) {
      console.error('Student login error:', error);
      setError(error.message || 'Student verification failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      persistDemoSession(updatedUser);
      setUser(updatedUser);
    }
  };

  const impersonateSchool = async (schoolId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Ask the backend to mint a real, short-lived, audited session for the
      // school's admin. The returned token carries an `impersonatedBy` claim,
      // so the backend authorises as the admin (not the super-admin) and every
      // action is attributable — unlike a purely client-side role swap.
      const res = await api.impersonateSchool(schoolId);
      if (!res.ok || !res.data?.authToken) {
        throw new Error(res.message || 'Failed to start impersonation');
      }

      // Preserve the super-admin's current token so we can restore it on exit.
      originalTokenRef.current = window.localStorage.getItem(DEMO_AUTH_TOKEN_KEY);

      // Swap the active token to the impersonation token so apiClient uses it.
      window.localStorage.setItem(DEMO_AUTH_TOKEN_KEY, res.data.authToken);

      setOriginalUser(user);
      setUser(res.data);
    } catch (error: any) {
      console.error('Impersonation error:', error);
      setError(error.message || 'Failed to impersonate school');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const stopImpersonating = () => {
    // Restore the super-admin's original token (or fall back to Supabase if
    // there wasn't one), then restore the original user object.
    if (originalTokenRef.current) {
      window.localStorage.setItem(DEMO_AUTH_TOKEN_KEY, originalTokenRef.current);
    } else {
      window.localStorage.removeItem(DEMO_AUTH_TOKEN_KEY);
    }
    originalTokenRef.current = null;

    if (originalUser) {
      setUser(originalUser);
      setOriginalUser(null);
    }
  };

  const logout = async () => {
    // Clear local state and mark the logout as in-progress BEFORE calling
    // supabase.auth.signOut(). This prevents the SIGNED_OUT listener event
    // from restoring a demo session between the signOut() call and the
    // finally block that would otherwise clear the demo session.
    loggingOutRef.current = true;
    clearDemoSession();
    setUser(null);
    setOriginalUser(null);
    setIsLoading(true);
    setError(null);

    try {
      if (authMode === 'supabase') {
        await supabaseAuthService.logout();
      }
    } catch (error: any) {
      console.warn('Logout error:', error);
    } finally {
      loggingOutRef.current = false;
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    loginStudent,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isLoading,
    impersonateSchool,
    stopImpersonating,
    isImpersonating: !!originalUser,
    authMode,
    error,
    viewingSchoolId,
    setViewingSchoolId,
    isCreator,
    isGroupOwner,
    effectiveSchoolId,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {

  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
