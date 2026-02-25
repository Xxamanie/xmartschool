import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { UserRole } from '../../types';

const router = Router();

const activityScopeSchema = z.enum([
  'assessments',
  'results',
  'proctoring',
  'live_classes',
  'general',
]);

const activityStatusSchema = z.enum(['success', 'failed', 'fallback']);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  actorId: z.string().optional(),
  schoolId: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']).optional(),
  status: activityStatusSchema.optional(),
  scope: activityScopeSchema.optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = listQuerySchema.parse(req.query);
    const response = await appService.getAIActivities({
      ...filters,
      role: filters.role as UserRole | undefined,
    });
    res.json(response);
  }),
);

const createSchema = z.object({
  action: z.string().min(1),
  scope: activityScopeSchema.optional(),
  status: activityStatusSchema.optional(),
  actorId: z.string().optional(),
  actorRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT']).optional(),
  schoolId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.logAIActivity({
      action: payload.action,
      scope: payload.scope,
      status: payload.status,
      actorId: payload.actorId,
      actorRole: payload.actorRole as UserRole | undefined,
      schoolId: payload.schoolId,
      metadata: payload.metadata,
    });
    res.json(response);
  }),
);

export { router as aiActivityRouter };
