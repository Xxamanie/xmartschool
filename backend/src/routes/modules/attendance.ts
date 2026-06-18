import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const getSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format, expected YYYY-MM-DD'),
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

// Batch attendance summary for multiple students
router.get(
  '/summaries',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ ids: z.string().min(1).max(5000) });
    const { ids } = schema.parse(req.query);
    const studentIds = ids.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.getStudentsAttendanceSummaries(studentIds, schoolId);
    res.json(response);
  }),
);

// Single student summary
router.get(
  '/student-summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ studentId: z.string().min(1) });
    const { studentId } = schema.parse(req.query);
    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.getStudentAttendanceSummary(effectiveStudentId, schoolId);
    res.json(response);
  }),
);

const markSchema = z.array(
  z.object({
    studentId: z.string().min(1),
    status: z.enum(['Present', 'Absent', 'Late', 'Excused']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  }),
).min(1).max(500);

const parseAttendancePayload = (body: unknown) => {
  if (Array.isArray(body)) return markSchema.parse(body);
  const payload = z.object({ updates: markSchema }).parse(body);
  return payload.updates;
};

// Note: `POST /` used to be a duplicate of `POST /batch` below (same
// handler, same schema). The frontend only calls `/attendance/batch`, so
// the duplicate route has been removed.

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
