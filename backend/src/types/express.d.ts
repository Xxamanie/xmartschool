import { UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        schoolId?: string;
        groupId?: string;
        email?: string;
        provider: 'legacy-session' | 'supabase';
        // Set when the session was minted via SUPER_ADMIN impersonation.
        impersonatedBy?: string;
      };
    }
  }
}

export {};
