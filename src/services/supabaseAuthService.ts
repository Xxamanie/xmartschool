import { getSupabaseClient } from './supabaseClient';
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
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error ?? new Error('Login failed');
    return mapUser(data.user);
  },

  logout: async (): Promise<void> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user ? mapUser(data.user) : null;
  },

  onAuthStateChanged: (callback: (user: User | null) => void) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      callback(null);
      return () => {};
    }
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
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
};
