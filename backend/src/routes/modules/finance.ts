import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';
import { appService } from '../../services/appService';
import { getEffectiveSchoolId } from '../../utils/tenant';
import { UserRole } from '../../types';

const router = Router();

// ── Fee Templates ─────────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  schoolId: z.string().min(1),
  term: z.string().min(1),
  name: z.string().min(1),
  scopeType: z.enum(['schoolClass', 'classMaster']).optional(),
  scopeId: z.string().optional(),
  lines: z
    .array(
      z.object({
        title: z.string().min(1),
        key: z.string().min(1),
        defaultAmount: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
});

router.get(
  '/templates',
  requireAuth,
  asyncHandler(async (req, res) => {
    const querySchema = z.object({
      schoolId: z.string().min(1),
      term: z.string().optional(),
    });
    const { schoolId, term } = querySchema.parse(req.query);

    const templates = await prisma.feeTemplate.findMany({
      where: {
        schoolId,
        ...(term ? { term } : {}),
      },
      include: {
        lines: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, data: templates });
  }),
);

router.post(
  '/templates',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { schoolId, term, name, scopeType, scopeId, lines } =
      createTemplateSchema.parse(req.body);

    const template = await prisma.feeTemplate.create({
      data: {
        schoolId,
        term,
        name,
        scopeType,
        scopeId,
        lines: {
          create: (lines ?? []).map((line, index) => ({
            title: line.title,
            key: line.key,
            order: index,
            defaultAmount: line.defaultAmount ?? 0,
          })),
        },
      },
      include: {
        lines: { orderBy: { order: 'asc' } },
      },
    });

    res.json({ ok: true, data: template });
  }),
);

router.delete(
  '/templates/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);

    if (req.auth?.role !== UserRole.SUPER_ADMIN) {
      const template = await prisma.feeTemplate.findUnique({ where: { id }, select: { schoolId: true } });
      if (!template) {
        res.status(404).json({ ok: false, data: null, message: 'Template not found' });
        return;
      }
      if (template.schoolId !== req.auth?.schoolId) {
        res.status(403).json({ ok: false, data: null, message: 'Cannot delete a template from another school' });
        return;
      }
    }

    await prisma.feeTemplate.delete({ where: { id } });
    res.json({ ok: true, data: true });
  }),
);

// ── Ledger Generation ─────────────────────────────────────────────────────

const generateLedgerSchema = z.object({
  templateId: z.string().min(1),
  studentIds: z.array(z.string().min(1)).min(1),
  term: z.string().min(1),
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
  schoolId: z.string().optional(),
});

router.post(
  '/ledgers/generate',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = generateLedgerSchema.parse(req.body);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? data.schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const response = await appService.generateLedger({
      ...data,
      schoolId: effectiveSchoolId,
    });
    res.json(response);
  }),
);

router.get(
  '/ledgers',
  requireAuth,
  asyncHandler(async (req, res) => {
    const querySchema = z.object({
      schoolId: z.string().optional(),
      term: z.string().optional(),
      scopeType: z.string().optional(),
      scopeId: z.string().optional(),
      studentId: z.string().optional(),
    });
    const params = querySchema.parse(req.query);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? params.schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const response = await appService.getLedgers({ ...params, schoolId: effectiveSchoolId });
    res.json(response);
  }),
);

// ── Payments ──────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  ledgerItemId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().optional(),
  paymentRef: z.string().optional(),
  clientRef: z.string().optional(),
  schoolId: z.string().optional(),
});

router.post(
  '/payments',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = paymentSchema.parse(req.body);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? data.schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const response = await appService.recordPayment({ ...data, schoolId: effectiveSchoolId, actorUserId: req.auth?.userId });
    res.json(response);
  }),
);

// ── Finance Summary (for school owner dashboard) ──────────────────────────

router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (req, res) => {
    const querySchema = z.object({
      schoolId: z.string().optional(),
      term: z.string().optional(),
    });
    const { schoolId, term } = querySchema.parse(req.query);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const response = await appService.getSchoolFinanceSummary(effectiveSchoolId, term);
    res.json(response);
  }),
);

export { router as financeRouter };
