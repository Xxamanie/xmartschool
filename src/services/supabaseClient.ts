import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _supabaseClient: any = null;

const initializeSupabase = () => {
  if (_supabaseClient) return _supabaseClient;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
    return null;
  }

  _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  
  return _supabaseClient;
};

export const getSupabaseClient = () => initializeSupabase();
