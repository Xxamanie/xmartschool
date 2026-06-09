import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';
import { enforceTenantQuery, getEffectiveSchoolId } from '../../utils/tenant';

const router = Router();

const listQuery = z.object({
  schoolId: z.string().min(1).optional(),
});

router.get(
  '/',
  enforceTenantQuery,
  asyncHandler(async (req, res) => {
    const { schoolId } = listQuery.parse(req.query);
    const effectiveSchoolId = schoolId ?? getEffectiveSchoolId(req);
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: [], message: 'schoolId is required' });
      return;
    }

    const response = await appService.listCalendarEvents(effectiveSchoolId);
    res.json(response);
  }),
);

const createSchema = z.object({
  schoolId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startAt: z.union([z.string().datetime(), z.date()]),
  endAt: z.union([z.string().datetime(), z.date()]).optional().nullable(),
});

router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? payload.schoolId
      : req.auth?.schoolId;

    if (!schoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId is required' });
      return;
    }

    const response = await appService.createCalendarEvent({
      schoolId,
      title: payload.title,
      description: payload.description ?? null,
      location: payload.location ?? null,
      startAt: payload.startAt instanceof Date ? payload.startAt : new Date(payload.startAt),
      endAt: payload.endAt
        ? payload.endAt instanceof Date
          ? payload.endAt
          : new Date(payload.endAt)
        : null,
    });

    res.json(response);
  }),
);

const updateSchema = createSchema.partial().extend({
  title: z.string().min(1).optional(),
});

router.put(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const payload = updateSchema.parse(req.body);
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? payload.schoolId
      : req.auth?.schoolId;

    if (!schoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId is required' });
      return;
    }

    const response = await appService.updateCalendarEvent(id, {
      schoolId,
      title: payload.title,
      description: payload.description,
      location: payload.location,
      startAt: payload.startAt
        ? payload.startAt instanceof Date
          ? payload.startAt
          : new Date(payload.startAt)
        : undefined,
      endAt: payload.endAt === null
        ? null
        : payload.endAt
          ? payload.endAt instanceof Date
            ? payload.endAt
            : new Date(payload.endAt)
          : undefined,
    });

    res.json(response);
  }),
);

router.delete(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { schoolId } = z.object({ schoolId: z.string().min(1).optional() }).parse(req.query);
    const effectiveSchoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? schoolId
      : req.auth?.schoolId;

    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: false, message: 'schoolId is required' });
      return;
    }

    const response = await appService.deleteCalendarEvent(id, effectiveSchoolId);
    res.json(response);
  }),
);

export { router as eventsRouter };

