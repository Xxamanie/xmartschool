import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types';
import { verifySessionToken } from '../utils/session';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';

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

const resolveRequestAuth = async (token: string) => {
  const legacySession = verifySessionToken(token);
  if (legacySession) {
    return {
      userId: legacySession.sub,
      role: legacySession.role,
      schoolId: legacySession.schoolId,
      provider: 'legacy-session' as const,
    };
  }

  if (!supabaseAdmin) {
    return null;
  }

  let supabaseData: Awaited<ReturnType<typeof supabaseAdmin.auth.getUser>>;
  try {
    supabaseData = await supabaseAdmin.auth.getUser(token);
  } catch {
    // Network error, Supabase project paused, etc.
    return null;
  }
  const { data, error } = supabaseData;
  if (error || !data.user) {
    return null;
  }

  const metadata = data.user.user_metadata ?? {};
  const normalizedEmail = data.user.email?.toLowerCase();
  const mappedUser = normalizedEmail
    ? await prisma.user.findFirst({
        where: { email: normalizedEmail },
        select: { id: true, role: true, schoolId: true, email: true },
      })
    : null;

  const role = mappedUser?.role ?? metadata.role;
  if (!role || !Object.values(UserRole).includes(role as UserRole)) {
    return null;
  }

  const schoolId = mappedUser?.schoolId ?? metadata.schoolId;

  return {
    userId: mappedUser?.id ?? data.user.id,
    role: role as UserRole,
    schoolId: typeof schoolId === 'string' ? schoolId : undefined,
    email: mappedUser?.email ?? data.user.email ?? undefined,
    provider: 'supabase' as const,
  };
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }

  try {
    const auth = await resolveRequestAuth(token);
    if (!auth) {
      res.status(401).json({ ok: false, data: null, message: 'Invalid or expired session' });
      return;
    }

    req.auth = auth;
    next();
  } catch {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
  }
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

export const requireSchoolContext = (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }

  // PARENT accounts are linked to students directly — they don't need a schoolId for their own routes
  if (req.auth.role !== UserRole.SUPER_ADMIN && req.auth.role !== UserRole.PARENT && !req.auth.schoolId) {
    res.status(403).json({ ok: false, data: null, message: 'School context is required for this operation' });
    return;
  }

  next();
};
