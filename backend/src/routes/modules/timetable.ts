import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getEffectiveSchoolId } from '../../utils/tenant';
import { UserRole } from '../../types';
import {
  generateTimetable, getTimetable, updateTimetableSlot, clearTimetable, DAYS, PERIODS,
} from '../../services/timetableService';

const router = Router();

const schoolOf = (req: any, res: any): string | null => {
  const schoolId = getEffectiveSchoolId(req);
  if (!schoolId) {
    res.status(400).json({ ok: false, data: null, message: 'School context required' });
    return null;
  }
  return schoolId;
};

// GET /api/timetable  — read access for any authenticated user in the school.
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schoolId = schoolOf(req, res);
    if (!schoolId) return;
    const response = await getTimetable(schoolId);
    res.json({ ...response, config: { days: DAYS, periods: PERIODS } });
  }),
);

// POST /api/timetable/generate  — admin auto-scheduler.
router.post(
  '/generate',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = schoolOf(req, res);
    if (!schoolId) return;
    const response = await generateTimetable(schoolId);
    res.json(response);
  }),
);

// PUT /api/timetable/slot  — admin manual override of one slot.
const slotSchema = z.object({
  schoolClassId: z.string().min(1),
  day: z.number().int().min(0).max(DAYS - 1),
  period: z.number().int().min(0).max(PERIODS - 1),
  subjectId: z.string().min(1).nullable(),
});

router.put(
  '/slot',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = schoolOf(req, res);
    if (!schoolId) return;
    const body = slotSchema.parse(req.body);
    const response = await updateTimetableSlot({ schoolId, ...body });
    res.json(response);
  }),
);

// DELETE /api/timetable  — admin clears the school timetable.
router.delete(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = schoolOf(req, res);
    if (!schoolId) return;
    const response = await clearTimetable(schoolId);
    res.json(response);
  }),
);

export { router as timetableRouter };
