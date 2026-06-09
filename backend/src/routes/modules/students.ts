import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { UserRole } from '../../types';

const router = Router();

const idParam = z.object({ id: z.string().min(1) });

// ── Student: my profile (fee status) — must be before /:id ───────────────────

router.get(
  '/my-profile',
  requireAuth,
  requireRole(UserRole.STUDENT),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findUnique({
      where: { id: req.auth!.userId },
      select: { id: true, name: true, resultPin: true } as any,
    });
    if (!student) {
      res.status(404).json({ ok: false, data: null, message: 'Student not found' });
      return;
    }
    res.json({
      ok: true,
      data: {
        id: (student as any).id,
        name: (student as any).name,
        feeCleared: !!(student as any).resultPin,
      },
    });
  }),
);

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
  asyncHandler(async (req, res) => {
    const response = await appService.getClassMasters(req.auth!.schoolId!);
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
    const response = await appService.assignClassMaster(grade, teacherId, req.auth!.schoolId!);
    res.json(response);
  }),
);

// ── GET single ───────────────────────────────────────────────────────────────

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.getStudentById(id, schoolId);
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
    const response = await appService.createStudent(data as any, effectiveSchoolId, req.auth?.userId);
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
      req.auth?.userId,
    );
    res.json(response);
  }),
);

// ── Regenerate Result PIN (admin or form master for student's class) ──────────

router.post(
  '/:id/regenerate-pin',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  asyncHandler(async (req, res) => {
    const { id: studentId } = idParam.parse(req.params);
    const actorRole = req.auth?.role;
    const actorId = req.auth?.userId;
    const actorSchoolId = req.auth?.schoolId;

    // Admin/super admin: always allowed within their school
    const isAdmin = actorRole === UserRole.ADMIN || actorRole === UserRole.SUPER_ADMIN;

    if (!isAdmin) {
      // For teachers: must be a form master whose grade matches the student's grade
      if (actorRole !== UserRole.TEACHER) {
        res.status(403).json({ ok: false, data: null, message: 'Not authorised to regenerate PINs' });
        return;
      }

      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { grade: true, schoolId: true },
      });
      if (!student || student.schoolId !== actorSchoolId) {
        res.status(403).json({ ok: false, data: null, message: 'Student not found in your school' });
        return;
      }

      const isMaster = await prisma.classMaster.findFirst({
        where: { teacherId: actorId!, grade: student.grade, schoolId: actorSchoolId! },
        select: { id: true },
      });
      if (!isMaster) {
        res.status(403).json({ ok: false, data: null, message: 'Only the form master for this student\'s class can regenerate their PIN' });
        return;
      }
    }

    const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const newPin = Array.from(crypto.randomBytes(8), b => CHARSET[b % CHARSET.length]).join('');

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { resultPin: newPin } as any,
    });

    // Notify parent(s) of the new PIN
    try {
      const parentLinks = await (prisma as any).parentStudent.findMany({
        where: { studentId },
        include: { parent: { select: { id: true } } },
      });
      if (parentLinks.length > 0) {
        const schoolId = actorSchoolId ?? (updated as any).schoolId;
        const pinTerm = (updated as any).resultPinTerm ?? 'current term';
        const notification = await prisma.notification.create({
          data: {
            title: `Result Access PIN updated — ${(updated as any).name}`,
            message: `The Result Access PIN for ${(updated as any).name} (${pinTerm}) has been regenerated. New PIN: ${newPin}. Share this with your ward to access their results.`,
            audience: 'specific_users' as any,
            sourceRole: actorRole as any,
            schoolId: schoolId ?? null,
          },
        });
        await prisma.notificationRecipient.createMany({
          data: parentLinks.map((link: any) => ({ notificationId: notification.id, userId: link.parent.id })),
          skipDuplicates: true,
        });
      }
    } catch (err) {
      console.error('[RegeneratePin] Parent notification failed:', err);
    }

    res.json({ ok: true, data: { resultPin: newPin }, message: 'PIN regenerated successfully' });
  }),
);

export { router as studentsRouter };
