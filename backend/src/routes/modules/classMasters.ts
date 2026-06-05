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
  asyncHandler(async (req, res) => {
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? (req.query.schoolId as string | undefined) ?? req.auth?.schoolId ?? ''
      : req.auth?.schoolId ?? '';
    if (!schoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId required' });
      return;
    }
    const response = await appService.getClassMasters(schoolId);
    res.json(response);
  }),
);

router.put(
  '/:grade',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { grade } = z.object({ grade: z.string().min(1) }).parse(req.params);
    const { teacherId } = z.object({ teacherId: z.string().min(1) }).parse(req.body);
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? (req.body.schoolId as string | undefined) ?? req.auth?.schoolId ?? ''
      : req.auth?.schoolId ?? '';
    if (!schoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId required' });
      return;
    }
    const response = await appService.assignClassMaster(grade, teacherId, schoolId);
    res.json(response);
  }),
);

export { router as classMastersRouter };
