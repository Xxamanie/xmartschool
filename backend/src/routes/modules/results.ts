import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  studentId: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studentId } = listQuery.parse(req.query);
    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const response = await appService.getResults(req.auth?.schoolId, effectiveStudentId);
    res.json(response);
  }),
);

const resultDetailsSchema = z.record(z.number().optional());

const resultSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  studentName: z.string().trim().optional().default(''),
  subjectName: z.string().trim().min(1),
  average: z.number().min(0).max(100),
  grade: z.string().trim().min(1).max(10),
  status: z.enum(['Published', 'Draft', 'withheld']),
  remarks: z.string().trim().max(1000).optional(),
  details: resultDetailsSchema.optional(),
});

const publishSchema = z.union([
  z.array(resultSchema),
  z.object({
    results: z.array(resultSchema),
  }),
]);

router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const results = Array.isArray(payload) ? payload : payload.results;
    const response = await appService.publishResults(req.auth?.schoolId, results as any);
    res.json(response);
  }),
);

router.post(
  '/publish',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const results = Array.isArray(payload) ? payload : payload.results;
    const response = await appService.publishResults(req.auth?.schoolId, results as any);
    res.json(response);
  }),
);

export { router as resultsRouter };
