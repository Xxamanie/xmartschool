import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const idParam = z.object({ id: z.string().min(1) });

// ── GET list ─────────────────────────────────────────────────────────────────

const listQuery = z.object({
  schoolId: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { schoolId } = listQuery.parse(req.query);
    const effectiveSchoolId =
      req.auth?.role === UserRole.SUPER_ADMIN ? schoolId : req.auth?.schoolId;
    const response = await appService.getStudents(effectiveSchoolId);
    res.json(response);
  }),
);

// ── Form-masters must come before /:id so Express does not swallow "form-masters" as an id

router.get(
  '/form-masters',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const response = await appService.getClassMasters();
    res.json(response);
  }),
);

const assignSchema = z.object({
  grade: z.string().min(1),
  teacherId: z.string().min(1),
});

router.post(
  '/form-masters',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { grade, teacherId } = assignSchema.parse(req.body);
    const response = await appService.assignClassMaster(grade, teacherId);
    res.json(response);
  }),
);

// ── GET single ───────────────────────────────────────────────────────────────

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const response = await appService.getStudentById(id);
    res.json(response);
  }),
);

// ── CREATE ───────────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gender: z.enum(['Male', 'Female']),
  grade: z.string().trim().min(1).max(50),
  status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
  enrollmentDate: z.string().optional(),
  gpa: z.number().min(0).max(5).optional(),
  attendance: z.number().min(0).max(100).optional(),
  accessCode: z.string().trim().max(100).optional(),
  enrolledSubjects: z.array(z.string()).optional(),
  schoolClassId: z.string().optional(),
  field: z.string().optional(),
  schoolId: z.string().optional(),
});

router.post(
  '/',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    // Treat empty string the same as absent — fall back to auth-token schoolId
    const effectiveSchoolId =
      req.auth?.role === UserRole.SUPER_ADMIN
        ? (data.schoolId?.trim() || req.auth?.schoolId)
        : req.auth?.schoolId;
    const response = await appService.createStudent(data as any, effectiveSchoolId);
    res.json(response);
  }),
);

// ── UPDATE ───────────────────────────────────────────────────────────────────

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    gender: z.enum(['Male', 'Female']).optional(),
    grade: z.string().optional(),
    status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
    enrollmentDate: z.string().optional(),
    gpa: z.number().min(0).max(5).optional(),
    attendance: z.number().min(0).max(100).optional(),
    accessCode: z.string().trim().min(1).max(100).optional(),
    enrolledSubjects: z.array(z.string().min(1)).optional(),
  })
  .strict();

router.put(
  '/:id',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updates = updateSchema.parse(req.body);
    const response = await appService.updateStudentForSchool(
      id,
      updates,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

// ── DELETE ───────────────────────────────────────────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const response = await appService.deleteStudentForSchool(
      id,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

export { router as studentsRouter };
