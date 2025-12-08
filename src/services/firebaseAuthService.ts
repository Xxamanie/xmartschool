import { supabaseAuthService } from './supabaseAuthService';

// Legacy re-export to avoid breaking imports. Firebase has been removed.
export const firebaseAuthService = supabaseAuthService;
export default supabaseAuthService;
