import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth } from '../../middleware/auth';
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

export { router as usersRouter };
