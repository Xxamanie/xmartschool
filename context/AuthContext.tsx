import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { firebaseAuthService } from '../src/services/firebaseAuthService';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = firebaseAuthService.onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          role: UserRole.TEACHER,
          schoolId: 'default'
        });
      } else {
        const token = localStorage.getItem('auth_token');
        if (token) {
          setUser({ id: 'session_user', name: 'User', email: '', role: UserRole.TEACHER });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      if (password) {
        try {
          const firebaseUser = await firebaseAuthService.login(email, password);
          setUser(firebaseUser);
        } catch (firebaseError) {
          console.warn('Firebase auth failed, trying backend API:', firebaseError);
          const response = await api.login(email);
          if (response.ok) {
            setUser(response.data);
          } else {
            throw new Error('Login failed');
          }
        }
      } else {
        const response = await api.login(email);
        if (response.ok) {
          setUser(response.data);
        } else {
          throw new Error('Login failed');
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginStudent = async (schoolCode: string, studentCode: string) => {
    setIsLoading(true);
    try {
        const response = await api.verifyStudent(schoolCode, studentCode);
        if (response.ok) {
            setUser(response.data);
        } else {
            throw new Error(response.message || 'Verification failed');
        }
    } catch (error) {
        console.error(error);
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
            avatar: `https://ui-avatars.com/api/?name=${school.adminName}&background=random`
        };
        setUser(impersonatedUser);
    } catch (e) {
        console.error(e);
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
    try {
      await firebaseAuthService.logout();
      setUser(null);
      setOriginalUser(null);
      localStorage.removeItem('auth_token');
    } catch (error) {
      console.error('Logout error:', error);
      setUser(null);
      setOriginalUser(null);
      localStorage.removeItem('auth_token');
    }
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        login, 
        loginStudent, 
        logout, 
        updateUser,
        isAuthenticated: !!user, 
        isLoading,
        impersonateSchool,
        stopImpersonating,
        isImpersonating: !!originalUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};