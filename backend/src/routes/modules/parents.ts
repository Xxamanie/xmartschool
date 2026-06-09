import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

// ── List parents for a school (admin only) ────────────────────────────────

router.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? (req.query.schoolId as string | undefined) ?? req.auth?.schoolId ?? ''
      : req.auth?.schoolId ?? '';
    if (!schoolId) { res.status(400).json({ ok: false, data: null, message: 'schoolId required' }); return; }
    const response = await appService.getSchoolParents(schoolId);
    res.json(response);
  }),
);

// ── Create a parent account and link to students ──────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  studentIds: z.array(z.string().min(1)).min(1, 'Link at least one student'),
  schoolId: z.string().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? (payload.schoolId ?? req.auth?.schoolId ?? '')
      : req.auth?.schoolId ?? '';
    if (!schoolId) { res.status(400).json({ ok: false, data: null, message: 'schoolId required' }); return; }
    const response = await appService.createParent({ ...payload, schoolId });
    res.json(response);
  }),
);

// ── Get children data for a logged-in parent ─────────────────────────────

router.get(
  '/my-children',
  requireAuth,
  requireRole(UserRole.PARENT),
  asyncHandler(async (req, res) => {
    const response = await appService.getParentChildren(req.auth!.userId);
    res.json(response);
  }),
);

// ── Link / unlink a student from a parent (admin only) ───────────────────

router.post(
  '/:parentId/link',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { parentId } = z.object({ parentId: z.string().min(1) }).parse(req.params);
    const { studentId } = z.object({ studentId: z.string().min(1) }).parse(req.body);
    const actorSchoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.linkParentToStudent(parentId, studentId, actorSchoolId);
    res.json(response);
  }),
);

router.delete(
  '/:parentId/link/:studentId',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { parentId, studentId } = z.object({
      parentId: z.string().min(1),
      studentId: z.string().min(1),
    }).parse(req.params);
    const actorSchoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.unlinkParentFromStudent(parentId, studentId, actorSchoolId);
    res.json(response);
  }),
);

export { router as parentsRouter };
