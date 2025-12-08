import { supabase } from './supabaseClient';
import { User, UserRole } from '../../types';

const mapUser = (sessionUser: any): User => ({
  id: sessionUser.id,
  email: sessionUser.email ?? '',
  name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User',
  role: (sessionUser.user_metadata?.role as UserRole) || UserRole.TEACHER,
  schoolId: sessionUser.user_metadata?.schoolId || 'default',
});

export const supabaseAuthService = {
  login: async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error ?? new Error('Login failed');
    return mapUser(data.user);
  },

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const { data } = await supabase.auth.getUser();
    return data.user ? mapUser(data.user) : null;
  },

  onAuthStateChanged: (callback: (user: User | null) => void) => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback(mapUser(session.user));
      } else {
        callback(null);
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  },

  getAccessToken: async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
};
