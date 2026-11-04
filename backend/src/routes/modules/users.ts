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

const searchQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

// Server-side searchable, paginated listing for the Creator dashboard.
// SUPER_ADMIN sees all schools; everyone else is scoped to their own school.
router.get(
  '/search',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { search, page, pageSize } = searchQuerySchema.parse(req.query);
    const response = await appService.listUsers({
      schoolId: req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId,
      search,
      page,
      pageSize,
    });
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
  // Avatars are stored as either a regular URL or a compressed data: URL
  // (see components/PhotoUpload.tsx), so allow a much larger length than a
  // typical URL.
  avatar: z.string().url().max(2_000_000).optional(),
  schoolId: z.string().optional(),
});

const idParamSchema = z.object({ id: z.string().min(1) });

router.post('/:id/reset-password', requireAuth, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const response = await appService.resetUserPassword(id, req.auth!.role === UserRole.SUPER_ADMIN ? undefined : req.auth!.schoolId, req.auth!.userId);
  res.status(response.ok ? 200 : 403).json(response);
}));

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
