import React, { createContext, useContext, useState, PropsWithChildren } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

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

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const response = await api.login(email);
      if (response.ok) {
        setUser(response.data);
      } else {
        throw new Error('Login failed');
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
         setUser({ ...user, ...userData });
     }
  };

  const impersonateSchool = async (schoolId: string) => {
    setIsLoading(true);
    try {
        const schoolsRes = await api.getSchools();
        const school = schoolsRes.data.find(s => s.id === schoolId);
        if (!school) throw new Error("School not found");

        setOriginalUser(user);
        setUser({
            id: `imp_${school.id}`,
            name: `${school.adminName} (Impersonated)`,
            email: `admin@${school.code.toLowerCase()}.edu`,
            role: UserRole.ADMIN,
            schoolId: school.id,
            avatar: `https://ui-avatars.com/api/?name=${school.adminName}&background=random`
        });
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

  const logout = () => {
    setUser(null);
    setOriginalUser(null);
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