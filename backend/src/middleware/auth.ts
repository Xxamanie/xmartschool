import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types';
import { verifySessionToken } from '../utils/session';
import { supabaseAdmin } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { canAccessSchool } from '../utils/tenant';

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
    const identity = legacySession.role === UserRole.STUDENT
      ? await prisma.student.findUnique({ where: { id: legacySession.sub }, include: { school: true } })
      : await prisma.user.findUnique({ where: { id: legacySession.sub }, include: { school: true } });
    if (!identity || identity.sessionVersion !== legacySession.version) return null;
    if ('status' in identity ? identity.status !== 'Active' : !identity.active) return null;
    if (identity.school && (identity.school.status !== 'Active' || identity.school.deletedAt)) return null;
    const role = 'role' in identity ? identity.role as UserRole : UserRole.STUDENT;
    const groupId = 'groupId' in identity ? identity.groupId ?? undefined : undefined;
    if (role !== legacySession.role || identity.schoolId !== (legacySession.schoolId ?? null) || groupId !== legacySession.groupId) return null;
    if (legacySession.impersonatedBy) {
      const actor = await prisma.user.findUnique({ where: { id: legacySession.impersonatedBy } });
      if (!actor?.active || actor.sessionVersion !== legacySession.impersonatorVersion ||
        ![UserRole.SUPER_ADMIN, UserRole.GROUP_OWNER].includes(actor.role as UserRole) ||
        (actor.role === UserRole.GROUP_OWNER && (!identity.school || actor.groupId !== identity.school.groupId))) return null;
    }
    return {
      userId: identity.id,
      role,
      schoolId: identity.schoolId ?? undefined,
      groupId,
      provider: 'legacy-session' as const,
      impersonatedBy: legacySession.impersonatedBy,
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

  const normalizedEmail = data.user.email?.toLowerCase();
  let mappedUser = await prisma.user.findUnique({ where: { supabaseUserId: data.user.id }, include: { school: true } });
  if (!mappedUser && normalizedEmail && data.user.email_confirmed_at) {
    // Existing installations bind a verified email once; all subsequent requests use the stable provider ID.
    const candidate = await prisma.user.findFirst({ where: { email: normalizedEmail, supabaseUserId: null, active: true } });
    if (candidate) {
      await prisma.user.updateMany({ where: { id: candidate.id, supabaseUserId: null, active: true }, data: { supabaseUserId: data.user.id } });
      mappedUser = await prisma.user.findUnique({ where: { supabaseUserId: data.user.id }, include: { school: true } });
    }
  }
  if (!mappedUser?.active || !Object.values(UserRole).includes(mappedUser.role as UserRole)) return null;
  if (mappedUser.school && (mappedUser.school.status !== 'Active' || mappedUser.school.deletedAt)) return null;
  // getUser has authenticated this JWT; administrator-managed token metadata versions revoke old sessions.
  let providerVersion = 0;
  try { providerVersion = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).app_metadata?.sessionVersion ?? 0; } catch { return null; }
  if (providerVersion !== mappedUser.sessionVersion) return null;

  return {
    userId: mappedUser.id,
    role: mappedUser.role as UserRole,
    schoolId: mappedUser.schoolId ?? undefined,
    groupId: mappedUser.groupId ?? undefined,
    email: mappedUser.email ?? undefined,
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

export const requireSchoolContext = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }

  const selected = typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined;
  if (selected) {
    if (!await canAccessSchool(req.auth, selected)) {
      res.status(403).json({ ok: false, data: null, message: 'Cannot access this school' });
      return;
    }
    const school = await prisma.school.findFirst({ where: { id: selected, status: 'Active', deletedAt: null }, select: { id: true } });
    if (!school) { res.status(403).json({ ok: false, data: null, message: 'School is inactive or unavailable' }); return; }
    req.auth.schoolId = selected;
  }
  if (req.auth.role === UserRole.GROUP_OWNER && !req.auth.schoolId && !/^\/schools(?:\/|$)/.test(req.path)) {
    res.status(400).json({ ok: false, data: null, message: 'Select an accessible school for this operation' });
    return;
  }
  if (
    req.auth.role !== UserRole.SUPER_ADMIN &&
    req.auth.role !== UserRole.GROUP_OWNER &&
    req.auth.role !== UserRole.PARENT &&
    !req.auth.schoolId
  ) {
    res.status(403).json({ ok: false, data: null, message: 'School context is required for this operation' });
    return;
  }

  next();
};
