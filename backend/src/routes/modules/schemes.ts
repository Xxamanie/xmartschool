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
  fileUrl: z.string().optional().default(''),
  term: z.string().min(1),
  subject: z.string().min(1),
  year: z.string().optional().default(new Date().getFullYear().toString()),
});

router.post(
  '/upload',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { fileName, fileUrl, term, subject } = uploadSchema.parse(req.body);
    const response = await appService.uploadScheme(fileName, { term, subject, fileUrl });
    res.json(response);
  }),
);

export { router as schemesRouter };
