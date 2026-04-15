import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types';
import { verifySessionToken } from '../utils/session';

const extractBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }

  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ ok: false, data: null, message: 'Invalid or expired session' });
    return;
  }

  req.auth = {
    userId: session.sub,
    role: session.role,
    schoolId: session.schoolId,
  };
  next();
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ ok: false, data: null, message: 'Insufficient permissions' });
      return;
    }

    next();
  };
};
