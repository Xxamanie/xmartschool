import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth } from '../../firebase-config';
import { User, UserRole } from '../../types';

export const firebaseAuthService = {
  login: async (email: string, password: string): Promise<User> => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();
      localStorage.setItem('auth_token', token);
      
      return {
        id: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || email.split('@')[0],
        role: UserRole.TEACHER,
        schoolId: 'default'
      };
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  },

  logout: async (): Promise<void> => {
    try {
      await signOut(auth);
      localStorage.removeItem('auth_token');
    } catch (error: any) {
      throw new Error(error.message || 'Logout failed');
    }
  },

  getCurrentUser: (): FirebaseUser | null => {
    return auth.currentUser;
  },

  onAuthStateChanged: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  },

  getIdToken: async (): Promise<string> => {
    if (!auth.currentUser) throw new Error('No user logged in');
    return await auth.currentUser.getIdToken();
  }
};
