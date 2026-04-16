import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const response = await appService.getSchools();
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  region: z.string().optional(),
  adminName: z.string().optional(),
  studentCount: z.number().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.createSchool(payload);
    res.json(response);
  }),
);

const idParam = z.object({ id: z.string().min(1) });

router.delete(
  '/:id',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const response = await appService.deleteSchool(id);
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
    const response = await appService.updateSchoolStatus(id, status);
    res.json(response);
  }),
);

export { router as schoolsRouter };
