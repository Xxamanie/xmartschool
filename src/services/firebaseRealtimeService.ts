import { supabase } from './supabaseClient';

// Basic realtime helpers using Supabase channels to replace Firebase RTDB.
export const firebaseRealtimeService = {
  write: async (table: string, data: any): Promise<void> => {
    const { error } = await supabase.from(table).upsert(data);
    if (error) throw error;
  },
  read: async (table: string, filters?: Record<string, any>) => {
    let query = supabase.from(table).select('*');
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value as any);
      });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  subscribe: (table: string, callback: (payload: any) => void) => {
    const channel = supabase.channel(`${table}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => callback(payload))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
