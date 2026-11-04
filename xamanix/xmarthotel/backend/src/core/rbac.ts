import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { verifyToken, JwtPayload } from './auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }
  req.auth = payload;
  next();
};

/**
 * Allow OWNER and MANAGER always (they run the property), plus any explicitly
 * listed operational roles. Call with no args for a manager-and-above route.
 */
export const requireRole = (...allowed: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
      return;
    }
    const role = req.auth.role;
    if (role === 'OWNER' || role === 'MANAGER' || allowed.includes(role)) {
      next();
      return;
    }
    res.status(403).json({ ok: false, data: null, message: 'Insufficient permissions' });
  };

export {};
