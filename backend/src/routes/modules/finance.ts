import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireAuth, requireRole } from '../../middleware/auth';
import { appService } from '../../services/appService';
import { getEffectiveSchoolId, enforceTenantQuery } from '../../utils/tenant';
import { UserRole } from '../../types';
import { env } from '../../config/env';
import { initializeTransaction, paystackConfigured, verifyTransaction } from '../../services/paystackService';
import { toKobo } from '../../utils/money';

const router = Router();

// ── Online payments (Paystack) ────────────────────────────────────────────
const initPaymentSchema = z.object({
  ledgerItemId: z.string().min(1),
  email: z.string().email(),
  amount: z.number().positive().optional(),
});

const donationSchema = z.object({
  amount: z.number().positive(),
  email: z.string().email(),
  donorName: z.string().trim().min(1).optional(),
  message: z.string().trim().max(250).optional(),
  schoolId: z.string().trim().min(1).optional(),
});

router.post(
  '/donations/initialize',
  asyncHandler(async (req, res) => {
    if (!paystackConfigured()) {
      res.status(503).json({ ok: false, data: null, message: 'Online donations are not configured on this server.' });
      return;
    }

    const { amount, email, donorName, message, schoolId } = donationSchema.parse(req.body);
    const reference = `donation_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const data = await initializeTransaction({
      email,
      amountKobo: Math.round(amount * 100),
      reference,
      metadata: {
        donation: true,
        donorName: donorName || 'SmartSchool supporter',
        donorEmail: email,
        schoolId: schoolId || req.auth?.schoolId || 'general',
        message: message || 'School donation',
        actorUserId: req.auth?.userId,
      },
      callbackUrl: env.frontendUrl,
    });

    res.json({ ok: true, data });
  }),
);

router.get(
  '/donations/verify/:reference',
  asyncHandler(async (req, res) => {
    const { reference } = z.object({ reference: z.string().min(1) }).parse(req.params);
    const verified = await verifyTransaction(reference);
    res.json({
      ok: true,
      data: {
        recorded: verified.status === 'success',
        reference,
        verified: verified.status === 'success',
      },
    });
  }),
);

// Start a Paystack checkout for a single fee line; returns the URL to redirect to.
router.post(
  '/payments/initialize',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PARENT),
  asyncHandler(async (req, res) => {
    if (!paystackConfigured()) {
      res.status(503).json({ ok: false, data: null, message: 'Online payments are not configured on this server.' });
      return;
    }
    const { ledgerItemId, email, amount } = initPaymentSchema.parse(req.body);
    const item = await (prisma as any).studentFeeLedgerItem.findUnique({
      where: { id: ledgerItemId },
      include: { ledger: { select: { schoolId: true, studentId: true } }, payments: { select: { amount: true } } },
    });
    if (!item) {
      res.status(404).json({ ok: false, data: null, message: 'Fee item not found' });
      return;
    }
    const canPay = req.auth!.role === UserRole.PARENT
      ? await prisma.parentStudent.count({ where: { parentId: req.auth!.userId, studentId: item.ledger.studentId } }) > 0
      : req.auth!.role === UserRole.SUPER_ADMIN || item.ledger.schoolId === req.auth!.schoolId;
    if (!canPay) {
      res.status(403).json({ ok: false, data: null, message: 'Fee item is not accessible' });
      return;
    }
    const payableKobo = toKobo(item.payableAmount);
    const paidKobo = item.payments.reduce((sum: number, payment: { amount: number | string | { toString(): string } }) => sum + toKobo(payment.amount), 0);
    const outstandingKobo = Math.max(0, payableKobo - paidKobo);
    const payAmountKobo = amount === undefined ? outstandingKobo : toKobo(amount);
    if (payAmountKobo <= 0) {
      res.status(400).json({ ok: false, data: null, message: 'This fee line is already fully paid.' });
      return;
    }
    if (payAmountKobo > outstandingKobo) {
      res.status(400).json({ ok: false, data: null, message: 'Amount exceeds the outstanding balance.' });
      return;
    }
    const reference = `xss_${ledgerItemId.slice(0, 8)}_${crypto.randomBytes(6).toString('hex')}`;
    const data = await initializeTransaction({
      email,
      amountKobo: payAmountKobo,
      reference,
      metadata: {
        ledgerItemId,
        schoolId: item.ledger.schoolId,
        studentId: item.ledger.studentId,
        actorUserId: req.auth?.userId,
      },
      callbackUrl: env.frontendUrl,
    });
    res.json({ ok: true, data });
  }),
);

// Verify a reference and post it to the ledger (browser callback path).
router.get(
  '/payments/verify/:reference',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { reference } = z.object({ reference: z.string().min(1) }).parse(req.params);
    const response = await appService.recordOnlinePayment(reference);
    res.json(response);
  }),
);

// Bulk fee reminders to parents of owing students (SMS / WhatsApp).
router.post(
  '/reminders',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schoolId = getEffectiveSchoolId(req);
    if (!schoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const { term, channel } = z.object({
      term: z.string().optional(),
      channel: z.enum(['sms', 'whatsapp']).optional(),
    }).parse(req.body);
    const response = await appService.sendFeeReminders(schoolId, term, channel ?? 'sms', req.auth?.userId);
    res.json(response);
  }),
);

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
  enforceTenantQuery,
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
    const { schoolId: bodySchoolId, term, name, scopeType, scopeId, lines } =
      createTemplateSchema.parse(req.body);

    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? bodySchoolId
      : req.auth?.schoolId;

    if (!schoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId is required' });
      return;
    }

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
    if (req.auth?.role === UserRole.PARENT) {
      const child = params.studentId && await prisma.parentStudent.findFirst({
        where: { parentId: req.auth.userId, studentId: params.studentId }, include: { student: { select: { schoolId: true } } },
      });
      if (!child) {
        res.status(403).json({ ok: false, data: [], message: 'Select one of your linked children' });
        return;
      }
      res.json(await appService.getLedgers({ ...params, schoolId: child.student.schoolId }));
      return;
    }
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
  clientRef: z.string().trim().min(1).max(128).optional(),
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

// ── Group (consolidated) Finance Summary — Group Owner only ───────────────
router.get(
  '/group-summary',
  requireAuth,
  requireRole(UserRole.GROUP_OWNER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { term, groupId: q } = z.object({ term: z.string().optional(), groupId: z.string().optional() }).parse(req.query);
    // Group Owners are locked to their own group; SUPER_ADMIN may pass one.
    const groupId = req.auth?.role === UserRole.GROUP_OWNER ? req.auth?.groupId : q;
    if (!groupId) {
      res.status(400).json({ ok: false, data: null, message: 'No group context' });
      return;
    }
    const response = await appService.getGroupFinanceSummary(groupId, term);
    res.json(response);
  }),
);

// Cross-branch analytics (benchmarking + at-risk) — Group Owner.
router.get(
  '/group-analytics',
  requireAuth,
  requireRole(UserRole.GROUP_OWNER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { groupId: q } = z.object({ groupId: z.string().optional() }).parse(req.query);
    const groupId = req.auth?.role === UserRole.GROUP_OWNER ? req.auth?.groupId : q;
    if (!groupId) {
      res.status(400).json({ ok: false, data: null, message: 'No group context' });
      return;
    }
    const response = await appService.getGroupAnalytics(groupId);
    res.json(response);
  }),
);

export { router as financeRouter };
