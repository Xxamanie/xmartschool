import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { prisma } from '../lib/prisma';

// Roles that operate across more than one school and therefore pass the active
// school as a query parameter rather than carrying a single schoolId.
const MULTI_SCHOOL_ROLES = [UserRole.SUPER_ADMIN, UserRole.GROUP_OWNER];

export const getEffectiveSchoolId = (req: Request): string | undefined => {
  if (!req.auth) {
    return undefined;
  }

  if (MULTI_SCHOOL_ROLES.includes(req.auth.role)) {
    return typeof req.query.schoolId === 'string' ? req.query.schoolId : req.auth.schoolId;
  }

  return req.auth.schoolId;
};

/**
 * Returns the set of school ids a user may act on:
 *   SUPER_ADMIN → null  (meaning "all schools", no filter)
 *   GROUP_OWNER → every (non-deleted) school in their group
 *   everyone    → their single school (or [] if none)
 */
export const getAccessibleSchoolIds = async (
  auth?: { userId?: string; role: UserRole; schoolId?: string; groupId?: string },
): Promise<string[] | null> => {
  if (!auth) return [];
  if (auth.role === UserRole.SUPER_ADMIN) return null;

  const ids = new Set<string>();

  // Single-school / single-group assignment (the original model).
  if (auth.schoolId) ids.add(auth.schoolId);
  if (auth.role === UserRole.GROUP_OWNER && auth.groupId) {
    const schools = await prisma.school.findMany({
      where: { groupId: auth.groupId, deletedAt: null } as any,
      select: { id: true },
    });
    schools.forEach((s: { id: string }) => ids.add(s.id));
  }

  // Phase 4: union any explicit memberships (multi-branch staff, etc.).
  // Guarded so it's a no-op until the Membership table is migrated.
  if (auth.userId) {
    try {
      const memberships = await (prisma as any).membership.findMany({
        where: { userId: auth.userId },
        select: { schoolId: true, groupId: true },
      });
      const groupIds = memberships.map((m: any) => m.groupId).filter(Boolean);
      memberships.forEach((m: any) => { if (m.schoolId) ids.add(m.schoolId); });
      if (groupIds.length) {
        const groupSchools = await prisma.school.findMany({
          where: { groupId: { in: groupIds }, deletedAt: null } as any,
          select: { id: true },
        });
        groupSchools.forEach((s: { id: string }) => ids.add(s.id));
      }
    } catch {
      // Membership table not present yet — ignore.
    }
  }

  return [...ids];
};

// True if the user is allowed to act on the given school id.
export const canAccessSchool = async (
  auth: { role: UserRole; schoolId?: string; groupId?: string } | undefined,
  schoolId: string,
): Promise<boolean> => {
  if (!auth) return false;
  const ids = await getAccessibleSchoolIds(auth);
  return ids === null || ids.includes(schoolId);
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

export const enforceTenantQuery = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }

  // Multi-school roles (Creator, Group Owner) pass schoolId as the active
  // school; group-scoped endpoints validate group membership at the data layer.
  if (typeof req.query.schoolId === 'string' && !await canAccessSchool(req.auth, req.query.schoolId)) {
    res.status(403).json({ ok: false, data: null, message: 'Cannot query another school' });
    return;
  }

  next();
};
