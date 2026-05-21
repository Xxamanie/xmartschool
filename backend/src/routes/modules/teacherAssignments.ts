import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

// GET /api/teacher-assignments?teacherId=xxx
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const teacherId = req.auth!.role === UserRole.TEACHER
      ? req.auth!.userId
      : z.string().min(1).parse(req.query.teacherId);
    const response = await appService.getTeacherAssignments(teacherId);
    res.json(response);
  }),
);

const setSchema = z.object({
  teacherId: z.string().min(1),
  assignments: z.array(z.object({
    subjectId: z.string().min(1),
    schoolClassId: z.string().min(1),
  })),
});

// PUT /api/teacher-assignments  (admin replaces all assignments for a teacher)
router.put(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { teacherId, assignments } = setSchema.parse(req.body);
    const response = await appService.setTeacherAssignments(teacherId, assignments);
    res.json(response);
  }),
);

export { router as teacherAssignmentsRouter };
