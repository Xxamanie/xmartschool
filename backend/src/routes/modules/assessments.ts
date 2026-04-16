import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  subjectId: z.string().optional(),
  term: z.string().optional(),
  studentId: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { subjectId, term, studentId } = listQuery.parse(req.query);
    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const response = await appService.getAssessments(req.auth?.schoolId, subjectId, term, effectiveStudentId);
    res.json(response);
  }),
);

const assessmentsSchema = z.array(z.any());

router.post(
  '/save',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const assessments = assessmentsSchema.parse(req.body);
    const response = await appService.saveAssessments(assessments as any);
    res.json(response);
  }),
);

export { router as assessmentsRouter };
