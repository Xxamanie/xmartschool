import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole, requireSchoolContext } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const response = req.auth?.role === UserRole.SUPER_ADMIN
      ? await appService.getAllUsers()
      : await appService.getUsersBySchoolId(req.auth?.schoolId ?? '');
    res.json(response);
  }),
);

const userPayloadSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  role: z.enum([UserRole.ADMIN, UserRole.TEACHER]).optional(),
  gender: z.enum(['Male', 'Female']).optional(),
  bio: z.string().trim().max(1000).optional(),
  avatar: z.string().url().max(2048).optional(),
  schoolId: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

router.post(
  '/',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = userPayloadSchema.parse(req.body);
    const response = await appService.createUserForSchool(
      payload,
      req.auth?.role === UserRole.SUPER_ADMIN ? payload.schoolId : req.auth?.schoolId,
      req.auth?.userId,
    );
    res.json(response);
  }),
);

router.put(
  '/:id',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const payload = userPayloadSchema.partial().parse(req.body);
    const response = await appService.updateUserForSchool(
      id,
      payload,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
    );
    res.json(response);
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireSchoolContext,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const response = await appService.deleteUserForSchool(
      id,
      req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
      req.auth?.userId,
    );
    res.json(response);
  }),
);

export { router as usersRouter };
