import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const fieldSchema = z.object({
  field: z.enum(['science', 'arts', 'business', 'general']),
  enrolledSubjects: z.array(z.string()).default([]),
});

router.put(
  '/:studentId/field',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const { field, enrolledSubjects } = fieldSchema.parse(req.body);
    const response = await appService.setStudentField(studentId, field, enrolledSubjects);
    res.json(response);
  }),
);

export { router as studentFieldRouter };
