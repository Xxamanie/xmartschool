import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.GROUP_OWNER),
  asyncHandler(async (req, res) => {
    // Group Owners see only their group's branches; others see all.
    const groupId = req.auth?.role === UserRole.GROUP_OWNER ? req.auth?.groupId : undefined;
    const response = await appService.getSchools(groupId);
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().optional(),
  region: z.string().trim().optional(),
  adminName: z.string().trim().optional(),
  adminEmail: z.string().email().optional(),
  studentCount: z.number().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.createSchool(payload, req.auth?.userId);
    res.json(response);
  }),
);

// Create a new SchoolGroup + GROUP_OWNER user in one transaction.
const groupOwnerSchema = z.object({
  groupName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  ownerEmail: z.string().email(),
  schoolIds: z.array(z.string().min(1)).optional(),
});

router.post(
  '/group-owner',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = groupOwnerSchema.parse(req.body);
    const response = await appService.createGroupOwner(payload, req.auth?.userId);
    res.json(response);
  }),
);

// SUPER_ADMIN impersonation: issues a real short-lived, audited session for the
// target school's admin instead of a client-only role swap.
const impersonateSchema = z.object({ schoolId: z.string().min(1) });

router.post(
  '/impersonate',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.GROUP_OWNER),
  asyncHandler(async (req, res) => {
    const { schoolId } = impersonateSchema.parse(req.body);
    const response = await appService.impersonateSchoolAdmin(schoolId, req.auth!.userId, {
      role: req.auth?.role,
      groupId: req.auth?.groupId,
    });
    res.json(response);
  }),
);

// ── School Groups: list + assign (Creator only) ───────────────────────────
router.get(
  '/groups',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (_req, res) => {
    const response = await appService.getGroups();
    res.json(response);
  }),
);

// The signed-in Group Owner's own group (name for their portfolio header).
router.get(
  '/my-group',
  requireAuth,
  requireRole(UserRole.GROUP_OWNER),
  asyncHandler(async (req, res) => {
    const response = await appService.getMyGroup(req.auth?.groupId);
    res.json(response);
  }),
);

const idParam = z.object({ id: z.string().min(1) });

router.patch(
  '/:id/group',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { groupId } = z.object({ groupId: z.string().nullable() }).parse(req.body);
    const response = await appService.assignSchoolToGroup(id, groupId, req.auth?.userId);
    res.json(response);
  }),
);

router.get(
  '/:id/classes',
  requireAuth,
  requireSchoolContext,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    if (req.auth?.role !== UserRole.SUPER_ADMIN && req.auth?.schoolId !== id) {
      res.status(403).json({ ok: false, data: null, message: 'Cannot view classes for another school' });
      return;
    }
    const response = await appService.getSchoolClasses(id);
    res.json(response);
  }),
);

const classSchema = z.object({ className: z.string().trim().min(1).max(120) });

router.post(
  '/:id/classes',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    if (req.auth?.role !== UserRole.SUPER_ADMIN && req.auth?.schoolId !== id) {
      res.status(403).json({ ok: false, data: null, message: 'Cannot add classes to another school' });
      return;
    }
    const { className } = classSchema.parse(req.body);
    const response = await appService.addSchoolClass(id, className);
    res.json(response);
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const response = await appService.deleteSchool(id, req.auth?.userId);
    res.json(response);
  }),
);

const statusSchema = z.object({ status: z.enum(['Active', 'Inactive']) });

router.patch(
  '/:id/status',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { status } = statusSchema.parse(req.body);
    const response = await appService.updateSchoolStatus(id, status, req.auth?.userId);
    res.json(response);
  }),
);

const brandingSchema = z.object({
  gradingSystem: z.string().optional(),
  themeColor: z.string().optional(),
  principalName: z.string().optional(),
  principalSignatureUrl: z.string().optional(),
  schoolStampUrl: z.string().optional(),
  motto: z.string().optional(),
  logoUrl: z.string().optional(),
  address: z.string().optional(),
  contact: z.string().optional(),
  adminName: z.string().optional(),
});

router.patch(
  '/:id/branding',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    if (req.auth?.role !== UserRole.SUPER_ADMIN && req.auth?.schoolId !== id) {
      res.status(403).json({ ok: false, data: null, message: 'Cannot update another school' });
      return;
    }
    const updates = brandingSchema.parse(req.body);
    const response = await appService.updateSchoolBranding(
      id,
      updates,
      req.auth?.role !== UserRole.SUPER_ADMIN ? req.auth?.schoolId : undefined,
    );
    res.json(response);
  }),
);

export { router as schoolsRouter };
