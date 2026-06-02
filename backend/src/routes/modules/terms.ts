import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
import { UserRole } from '../../types';
import { getEffectiveSchoolId } from '../../utils/tenant';

const router = Router();

const schoolQuery = z.object({ schoolId: z.string().optional() });
const idParam = z.object({ id: z.string().min(1) });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { schoolId } = schoolQuery.parse(req.query);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId required' });
      return;
    }
    const response = await appService.getSchoolTerms(effectiveSchoolId);
    res.json(response);
  }),
);

router.get(
  '/current',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { schoolId } = schoolQuery.parse(req.query);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId required' });
      return;
    }
    const response = await appService.getCurrentTerm(effectiveSchoolId);
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  session: z.string().trim().min(1).max(20),
  term: z.enum(['first', 'second', 'third']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isCurrent: z.boolean().optional(),
  schoolId: z.string().optional(),
});

router.post(
  '/',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const effectiveSchoolId = getEffectiveSchoolId(req) ?? data.schoolId;
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId required' });
      return;
    }
    const response = await appService.createSchoolTerm(effectiveSchoolId, data);
    res.json(response);
  }),
);

router.put(
  '/:id/current',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const effectiveSchoolId = getEffectiveSchoolId(req);
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const response = await appService.setCurrentTerm(id, effectiveSchoolId);
    res.json(response);
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const effectiveSchoolId = getEffectiveSchoolId(req);
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'School context required' });
      return;
    }
    const response = await appService.deleteSchoolTerm(id, effectiveSchoolId);
    res.json(response);
  }),
);

export { router as termsRouter };
