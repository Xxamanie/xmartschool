import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { UserRole } from '../../types';

const router = Router();

// GET /api/teacher-assignments?teacherId=xxx   OR   ?classId=xxx
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // classId query fetches all assignments for a class (used by Timetable)
    if (req.query.classId) {
      const classId = z.string().min(1).parse(req.query.classId);

      // Verify the requesting user has access to this class's school before
      // returning assignment data (teacher/subject names) for it.
      if (req.auth!.role !== UserRole.SUPER_ADMIN) {
        const schoolClass = await prisma.schoolClass.findUnique({
          where: { id: classId },
          select: { schoolId: true },
        });
        if (!schoolClass) {
          res.status(404).json({ ok: false, data: null, message: 'Class not found' });
          return;
        }
        if (schoolClass.schoolId !== req.auth!.schoolId) {
          res.status(403).json({ ok: false, data: null, message: 'Cannot access assignments from another school' });
          return;
        }
      }

      const response = await appService.getClassAssignments(classId);
      res.json(response);
      return;
    }
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
    const actorSchoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.setTeacherAssignments(teacherId, assignments, actorSchoolId);
    res.json(response);
  }),
);

export { router as teacherAssignmentsRouter };
