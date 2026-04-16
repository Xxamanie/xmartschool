import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const response = await appService.getSchemes(req.auth?.schoolId);
    res.json(response);
  }),
);

const uploadSchema = z.object({
  fileName: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

router.post(
  '/upload',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { fileName, metadata } = uploadSchema.parse(req.body);
    const response = await appService.uploadScheme(fileName, metadata);
    res.json(response);
  }),
);

export { router as schemesRouter };
