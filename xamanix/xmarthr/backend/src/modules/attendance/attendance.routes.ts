import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { markAbsenteesForOrg } from './attendance.service';

const router = Router();
const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const employeeOf = (req: Request): string | null => req.auth?.employeeId ?? null;
const LATE_HOUR = 9; // after 09:00 local counts as Late

router.post(
  '/clock-in',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = employeeOf(req);
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const now = new Date();
    const date = startOfDay(now);
    const late = now.getHours() >= LATE_HOUR && !(now.getHours() === LATE_HOUR && now.getMinutes() === 0);

    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: {}, // don't overwrite an existing clock-in
      create: { employeeId, date, clockIn: now, status: late ? 'Late' : 'Present' },
    });
    if (record.clockIn && record.clockIn.getTime() !== now.getTime() && record.clockIn < now) {
      // already clocked in earlier today
      return ok(res, record, 'Already clocked in today');
    }
    return ok(res, record, late ? 'Clocked in (late)' : 'Clocked in');
  }),
);

router.post(
  '/clock-out',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = employeeOf(req);
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const date = startOfDay();
    const existing = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (!existing || !existing.clockIn) return fail(res, 400, 'You have not clocked in today');
    const now = new Date();
    const workedMinutes = Math.max(0, Math.round((now.getTime() - existing.clockIn.getTime()) / 60000));
    const record = await prisma.attendanceRecord.update({ where: { id: existing.id }, data: { clockOut: now, workedMinutes } });
    return ok(res, record, 'Clocked out');
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = employeeOf(req);
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 90);
    const since = startOfDay(new Date(Date.now() - days * 86_400_000));
    const records = await prisma.attendanceRecord.findMany({ where: { employeeId, date: { gte: since } }, orderBy: { date: 'desc' } });
    return ok(res, records);
  }),
);

// HR/Manager: everyone's attendance for a given day (default today).
router.get(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId;
    if (!orgId) return fail(res, 400, 'No organisation context');
    const dateStr = req.query.date as string | undefined;
    const date = startOfDay(dateStr && !isNaN(new Date(dateStr).getTime()) ? new Date(dateStr) : new Date());
    const records = await prisma.attendanceRecord.findMany({
      where: { date, employee: { orgId } },
      include: { employee: { select: { firstName: true, lastName: true, staffNo: true } } },
      orderBy: { clockIn: 'asc' },
    });
    return ok(res, { date: date.toISOString().slice(0, 10), records });
  }),
);

// HR automation: mark every active employee with no record today as Absent.
router.post(
  '/mark-absent',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = req.auth!.orgId;
    if (!orgId) return fail(res, 400, 'No organisation context');
    const date = startOfDay();
    const marked = await markAbsenteesForOrg(orgId, date);
    return ok(res, { marked, date: date.toISOString().slice(0, 10) }, `Marked ${marked} absent`);
  }),
);

export const attendanceRouter = router;

