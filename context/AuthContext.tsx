import React, { createContext, useContext, useState, useEffect, PropsWithChildren } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { initializeCloudData, setupSyncListener } from '../services/cloud-api';

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

  // Check localStorage on mount for persisted user session
  useEffect(() => {
    // Initialize cloud data with sample data if empty (temporary solution)
    initializeCloudData();
    
    // Set up real-time sync listener for cross-device updates (temporary solution)
    setupSyncListener((type: string, data: any) => {
      console.log(`Real-time sync: ${type} updated`, data);
      // You can add specific handling for different data types here
      // For example, refresh user data if users are updated
      if (type === 'users' && user) {
        // Refresh current user data if it was updated
        const updatedUser = data.find((u: User) => u.id === user.id);
        if (updatedUser) {
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    });
    
    const savedUser = localStorage.getItem('user');
    const savedOriginalUser = localStorage.getItem('originalUser');
    
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
      } catch (error) {
        console.error('Failed to parse saved user data:', error);
        localStorage.removeItem('user');
      }
    }
    
    if (savedOriginalUser) {
      try {
        const originalUserData = JSON.parse(savedOriginalUser);
        setOriginalUser(originalUserData);
      } catch (error) {
        console.error('Failed to parse saved original user data:', error);
        localStorage.removeItem('originalUser');
      }
    }
  }, []);

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const response = await api.login(email);
      if (response.ok) {
        setUser(response.data);
        // Save to localStorage for persistence
        localStorage.setItem('user', JSON.stringify(response.data));
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
            // Save to localStorage for persistence
            localStorage.setItem('user', JSON.stringify(response.data));
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
         // Update localStorage
         localStorage.setItem('user', JSON.stringify(updatedUser));
     }
  };

  const impersonateSchool = async (schoolId: string) => {
    setIsLoading(true);
    try {
        const schoolsRes = await api.getSchools();
        const school = schoolsRes.data.find(s => s.id === schoolId);
        if (!school) throw new Error("School not found");

        setOriginalUser(user);
        // Save original user to localStorage
        if (user) {
            localStorage.setItem('originalUser', JSON.stringify(user));
        }

        const impersonatedUser = {
            id: `imp_${school.id}`,
            name: `${school.adminName} (Impersonated)`,
            email: `admin@${school.code.toLowerCase()}.edu`,
            role: UserRole.ADMIN,
            schoolId: school.id,
            avatar: `https://ui-avatars.com/api/?name=${school.adminName}&background=random`
        };
        setUser(impersonatedUser);
        // Save impersonated user to localStorage
        localStorage.setItem('user', JSON.stringify(impersonatedUser));
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
        // Restore original user in localStorage and remove impersonation
        localStorage.setItem('user', JSON.stringify(originalUser));
        localStorage.removeItem('originalUser');
    }
  };

  const logout = () => {
    setUser(null);
    setOriginalUser(null);
    // Clear all auth data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('originalUser');
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