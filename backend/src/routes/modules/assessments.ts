import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
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
    const teacherId = req.auth?.role === UserRole.TEACHER ? req.auth.userId : undefined;
    const response = await appService.getAssessments(req.auth?.schoolId, subjectId, term, effectiveStudentId, teacherId);
    res.json(response);
  }),
);

const assessmentSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  studentName: z.string().trim().optional().default(''),
  subjectId: z.string().min(1),
  term: z.string().trim().min(1).max(50),
  ca1: z.number().min(0).max(100),
  ca2: z.number().min(0).max(100),
  ca3: z.number().min(0).max(100),
  exam: z.number().min(0).max(100),
});

const assessmentsSchema = z.array(assessmentSchema);

const parseAssessmentsPayload = (body: unknown) => {
  if (Array.isArray(body)) {
    return assessmentsSchema.parse(body);
  }

  const payload = z.object({ assessments: assessmentsSchema }).parse(body);
  return payload.assessments;
};

router.put(
  '/',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const assessments = parseAssessmentsPayload(req.body);
    const response = await appService.saveAssessments(
      assessments as any,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

router.post(
  '/save',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const assessments = parseAssessmentsPayload(req.body);
    const response = await appService.saveAssessments(
      assessments as any,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

export { router as assessmentsRouter };
