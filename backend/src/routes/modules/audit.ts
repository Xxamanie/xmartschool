import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getEffectiveSchoolId } from '../../utils/tenant';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const querySchema = z.object({
      schoolId: z.string().optional(),
      limit: z.coerce.number().min(1).max(500).optional(),
    });
    const { schoolId, limit } = querySchema.parse(req.query);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId required' });
      return;
    }
    const response = await appService.getAuditLogs(effectiveSchoolId, limit ?? 100);
    res.json(response);
  }),
);

// Platform-wide audit log (Creator only) — no school scope.
router.get(
  '/global',
  requireAuth,
  requireRole(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { limit } = z.object({ limit: z.coerce.number().min(1).max(500).optional() }).parse(req.query);
    const response = await appService.getGlobalAuditLogs(limit ?? 100);
    res.json(response);
  }),
);

export { router as auditRouter };
