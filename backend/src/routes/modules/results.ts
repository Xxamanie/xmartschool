import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  studentId: z.string().optional(),
  term: z.string().optional(),
  pin: z.string().optional(),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { studentId, term, pin } = listQuery.parse(req.query);
    const effectiveStudentId =
      req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;

    // ── Fee-clearance + term-bound PIN gate for students ─────────────────
    if (req.auth?.role === UserRole.STUDENT) {
      const student = await prisma.student.findUnique({
        where: { id: req.auth.userId },
        select: { resultPin: true, resultPinTerm: true } as any,
      });
      const storedPin: string | null = (student as any)?.resultPin ?? null;
      const pinTerm: string | null = (student as any)?.resultPinTerm ?? null;

      if (!storedPin) {
        res.status(403).json({
          ok: false, data: null,
          feeStatus: 'not_cleared',
          message: 'Your school fees have not been cleared. Please contact your school to enable result access.',
        });
        return;
      }

      if (!pin || pin !== storedPin) {
        res.status(403).json({
          ok: false, data: null,
          feeStatus: 'pin_required',
          message: 'Please enter your Result Access PIN to view your results.',
        });
        return;
      }

      // PIN correct — now check that published results exist for this PIN's term
      const publishedCount = await prisma.result.count({
        where: {
          studentId: req.auth.userId,
          status: 'Published',
          ...(pinTerm ? { term: pinTerm } : {}),
        },
      });
      if (publishedCount === 0) {
        res.status(403).json({
          ok: false, data: null,
          feeStatus: 'results_not_published',
          message: 'Results for your current term have not been published yet. Please check back later.',
        });
        return;
      }
    }

    const response = await appService.getResults(
      req.auth?.schoolId,
      effectiveStudentId,
      term,
    );
    res.json(response);
  }),
);

const resultDetailsSchema = z.record(z.number().optional());

const resultSchema = z.object({
  id: z.string().optional(),
  studentId: z.string().min(1),
  studentName: z.string().trim().optional().default(''),
  subjectName: z.string().trim().min(1),
  term: z.string().trim().max(50).optional(),
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
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const results = Array.isArray(payload) ? payload : payload.results;
    const response = await appService.publishResults(req.auth?.schoolId, results as any, req.auth?.userId);
    res.json(response);
  }),
);

router.post(
  '/publish',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const results = Array.isArray(payload) ? payload : payload.results;
    const response = await appService.publishResults(req.auth?.schoolId, results as any, req.auth?.userId);
    res.json(response);
  }),
);

router.patch(
  '/:id/status',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { status } = z.object({ status: z.enum(['Published', 'Draft', 'withheld']) }).parse(req.body);
    await prisma.result.update({ where: { id }, data: { status } });
    res.json({ ok: true, data: true });
  }),
);

export { router as resultsRouter };
