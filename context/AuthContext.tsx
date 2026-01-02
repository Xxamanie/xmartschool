import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { supabaseAuthService } from '../src/services/supabaseAuthService';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'supabase' | 'demo' | 'unknown'>('unknown');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        setError(null);
        
        // Check if Supabase is configured
        if (supabaseAuthService.isConfigured()) {
          setAuthMode('supabase');
          
          // Try to get current user from Supabase
          const supabaseUser = await supabaseAuthService.getCurrentUser();
          if (supabaseUser) {
            setUser(supabaseUser);
          }
          
          // Set up auth state listener
          unsubscribe = supabaseAuthService.onAuthStateChanged((supabaseUser) => {
            setUser(supabaseUser);
            setIsLoading(false);
          });
        } else {
          setAuthMode('demo');
          console.log('Running in demo mode - Supabase not configured');
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
        setError('Failed to initialize authentication');
        setAuthMode('demo');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (password && authMode === 'supabase') {
        // Try Supabase authentication first
        try {
          const supabaseUser = await supabaseAuthService.login(email, password);
          setUser(supabaseUser);
          return;
        } catch (supabaseError: any) {
          console.warn('Supabase login failed:', supabaseError.message);
          
          // If Supabase is configured but login failed, don't fall back to demo
          if (supabaseAuthService.isConfigured()) {
            throw new Error(supabaseError.message || 'Invalid email or password');
          }
        }
      }

      // Fallback to API login (for demo/mock users)
      console.log('Attempting demo login for:', email);
      const response = await api.login(email);
      if (response.ok) {
        setUser(response.data);
        setAuthMode('demo');
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
      setUser(updatedUser);
    }
  };

  const impersonateSchool = async (schoolId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const schoolsRes = await api.getSchools();
      const school = schoolsRes.data.find(s => s.id === schoolId);
      if (!school) throw new Error("School not found");

      setOriginalUser(user);

      const impersonatedUser = {
        id: `imp_${school.id}`,
        name: `${school.adminName} (Impersonated)`,
        email: `admin@${school.code.toLowerCase()}.edu`,
        role: UserRole.ADMIN,
        schoolId: school.id,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(school.adminName)}&background=random`
      };
      setUser(impersonatedUser);
    } catch (error: any) {
      console.error('Impersonation error:', error);
      setError(error.message || 'Failed to impersonate school');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const stopImpersonating = () => {
    if (originalUser) {
      setUser(originalUser);
      setOriginalUser(null);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (authMode === 'supabase') {
        await supabaseAuthService.logout();
      }
    } catch (error: any) {
      console.warn('Logout error:', error);
      setError('Logout failed, but clearing local session');
    } finally {
      // Always clear local state
      setUser(null);
      setOriginalUser(null);
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
    error
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