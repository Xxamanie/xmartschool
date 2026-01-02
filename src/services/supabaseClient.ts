import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _supabaseClient: SupabaseClient | null = null;
let _initializationAttempted = false;

const initializeSupabase = (): SupabaseClient | null => {
  if (_supabaseClient) return _supabaseClient;
  
  if (_initializationAttempted && !_supabaseClient) {
    // Already tried and failed, don't retry
    return null;
  }
  
  _initializationAttempted = true;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
    console.warn('Falling back to demo mode.');
    return null;
  }

  try {
    _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    
    console.log('Supabase client initialized successfully');
    return _supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export const getSupabaseClient = () => initializeSupabase();

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};
