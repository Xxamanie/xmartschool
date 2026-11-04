import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import apiClient from '../utils/api';
import { User } from '../../types';

async function canonicalUser(): Promise<User> {
  const response = await apiClient.get('/auth/me');
  if (!response.data?.ok || !response.data?.data?.id) throw new Error(response.data?.message || 'This account has not been provisioned for XmartSchool.');
  return { ...response.data.data, provider: 'supabase' };
}
export const supabaseAuthService = {
  isConfigured: isSupabaseConfigured,
  login: async (email: string, password: string): Promise<User> => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase is not configured.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message || 'Login failed.');
    return canonicalUser();
  },
  logout: async () => {
    const { error } = await getSupabaseClient()?.auth.signOut() ?? {};
    if (error) throw new Error(error.message);
  },
  getCurrentUser: async (): Promise<User | null> => {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return null;
    return canonicalUser();
  },
  onAuthStateChanged: (callback: (hasSession: boolean) => void) => {
    const client = getSupabaseClient();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((_event, session) => callback(!!session));
    return () => data.subscription.unsubscribe();
  },
  sendPasswordResetEmail: async (email: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase is not configured.');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/?recovery=1' });
    if (error) throw new Error(error.message);
  },
  updatePassword: async (password: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase is not configured.');
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
  getAccessToken: async (): Promise<string | null> => {
    const { data } = await getSupabaseClient()?.auth.getSession() ?? {};
    return data?.session?.access_token ?? null;
  },
};

