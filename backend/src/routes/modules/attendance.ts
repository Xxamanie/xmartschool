import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const getSchema = z.object({
  date: z.string().min(1),
  grade: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { date, grade } = getSchema.parse(req.query);
    const response = await appService.getAttendance(date, grade, req.auth?.schoolId);
    res.json(response);
  }),
);

const markSchema = z.array(
  z.object({
    studentId: z.string().min(1),
    status: z.enum(['Present', 'Absent', 'Late', 'Excused']),
    date: z.string().min(1),
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = markSchema.parse(req.body);
    const response = await appService.markAttendance(payload);
    res.json(response);
  }),
);

export { router as attendanceRouter };
