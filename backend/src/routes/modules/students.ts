import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  schoolId: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { schoolId } = listQuery.parse(req.query);
    const effectiveSchoolId = req.auth?.role === UserRole.SUPER_ADMIN ? schoolId : req.auth?.schoolId;
    const response = await appService.getStudents(effectiveSchoolId);
    res.json(response);
  }),
);

const updateSchema = z
  .object({
    grade: z.string().optional(),
    status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
  })
  .passthrough();

const idParam = z.object({ id: z.string().min(1) });

router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updates = updateSchema.parse(req.body);
    const response = await appService.updateStudent(id, updates);
    res.json(response);
  }),
);

router.get(
  '/form-masters',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const response = await appService.getClassMasters();
    res.json(response);
  }),
);

const assignSchema = z.object({
  grade: z.string().min(1),
  teacherId: z.string().min(1),
});

router.post(
  '/form-masters',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { grade, teacherId } = assignSchema.parse(req.body);
    const response = await appService.assignClassMaster(grade, teacherId);
    res.json(response);
  }),
);

export { router as studentsRouter };
