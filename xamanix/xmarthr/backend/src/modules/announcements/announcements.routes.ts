import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { sendBulk, termiiEnabled } from '../notifications/termii.service';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

router.get(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const announcements = await prisma.announcement.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return ok(res, announcements);
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({
      message: z.string().min(1).max(1000),
      audience: z.enum(['All', 'Department']),
      departmentId: z.string().optional(),
      channel: z.enum(['generic', 'whatsapp']).optional(),
    }).parse(req.body);
    if (body.audience === 'Department' && !body.departmentId) return fail(res, 400, 'departmentId is required for a department announcement');

    // Active employees with a phone number, scoped to the chosen audience.
    const employees = await prisma.employee.findMany({
      where: { orgId, status: 'Active', phone: { not: null }, ...(body.audience === 'Department' ? { departmentId: body.departmentId } : {}) },
      select: { phone: true },
    });
    const sent = await sendBulk(employees.map((e) => e.phone), body.message, body.channel);

    const announcement = await prisma.announcement.create({
      data: { orgId, message: body.message, audience: body.audience, departmentId: body.departmentId, channel: body.channel ?? 'generic', sentCount: sent, createdById: req.auth!.sub },
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'SEND_ANNOUNCEMENT', entity: 'Announcement', entityId: announcement.id, metadata: { audience: body.audience, sent } });
    return ok(res, { ...announcement, recipients: employees.length }, termiiEnabled() ? `Sent to ${sent} of ${employees.length} recipient(s)` : 'Saved (messaging not configured)');
  }),
);

export const announcementsRouter = router;
