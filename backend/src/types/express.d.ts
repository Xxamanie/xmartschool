import { UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        schoolId?: string;
      };
    }
  }
}

export {};
