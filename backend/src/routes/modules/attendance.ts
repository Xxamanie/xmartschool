import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
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

const parseAttendancePayload = (body: unknown) => {
  if (Array.isArray(body)) {
    return markSchema.parse(body);
  }

  const payload = z.object({ updates: markSchema }).parse(body);
  return payload.updates;
};

router.post(
  '/',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = parseAttendancePayload(req.body);
    const response = await appService.markAttendance(
      payload,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

router.post(
  '/batch',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = parseAttendancePayload(req.body);
    const response = await appService.markAttendance(
      payload,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

export { router as attendanceRouter };
