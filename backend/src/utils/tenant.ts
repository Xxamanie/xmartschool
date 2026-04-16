import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export const getEffectiveSchoolId = (req: Request): string | undefined => {
  if (!req.auth) {
    return undefined;
  }

  if (req.auth.role === UserRole.SUPER_ADMIN) {
    return typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined;
  }

  return req.auth.schoolId;
};

export const ensureSameSchool = (
  resourceSchoolId: string | undefined,
  auth?: { role: UserRole; schoolId?: string },
): boolean => {
  if (!auth) {
    return false;
  }

  if (auth.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  return auth.schoolId !== undefined && auth.schoolId === resourceSchoolId;
};

export const requireSameSchool = (resourceSchoolId: string | undefined, auth?: { role: UserRole; schoolId?: string }) => {
  if (!ensureSameSchool(resourceSchoolId, auth)) {
    return {
      ok: false,
      status: 403,
      payload: { ok: false, data: null, message: 'Resource belongs to another school' },
    };
  }
  return null;
};

export const enforceTenantQuery = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }

  if (req.auth.role !== UserRole.SUPER_ADMIN && typeof req.query.schoolId === 'string' && req.query.schoolId !== req.auth.schoolId) {
    res.status(403).json({ ok: false, data: null, message: 'Cannot query another school' });
    return;
  }

  next();
};
