import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { User, UserRole } from '../../types';

const mapUser = (sessionUser: any): User => ({
  id: sessionUser.id,
  email: sessionUser.email ?? '',
  name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User',
  role: (sessionUser.user_metadata?.role as UserRole) || UserRole.TEACHER,
  schoolId: sessionUser.user_metadata?.schoolId || 'default',
});

export const supabaseAuthService = {
  isConfigured: (): boolean => {
    return isSupabaseConfigured();
  },

  login: async (email: string, password: string): Promise<User> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message || 'Login failed');
    }
    
    if (!data.user) {
      throw new Error('Login failed - no user data received');
    }
    
    return mapUser(data.user);
  },

  logout: async (): Promise<void> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message || 'Logout failed');
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('Failed to get current user:', error);
        return null;
      }
      return data.user ? mapUser(data.user) : null;
    } catch (error) {
      console.warn('Error getting current user:', error);
      return null;
    }
  },

  onAuthStateChanged: (callback: (user: User | null) => void) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      callback(null);
      return () => {};
    }
    
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (session?.user) {
          callback(mapUser(session.user));
        } else {
          callback(null);
        }
      } catch (error) {
        console.error('Error in auth state change handler:', error);
        callback(null);
      }
    });
    
    return () => {
      try {
        listener.subscription.unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing from auth state changes:', error);
      }
    };
  },

  getAccessToken: async (): Promise<string | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Failed to get session:', error);
        return null;
      }
      return data.session?.access_token ?? null;
    } catch (error) {
      console.warn('Error getting access token:', error);
      return null;
    }
  }
};
