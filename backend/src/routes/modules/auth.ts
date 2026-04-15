import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional().default(''),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const response = await appService.login(email, password);
    res.json(response);
  }),
);

const studentSchema = z.object({
  schoolCode: z.string().min(1),
  studentCode: z.string().min(1),
});

router.post(
  '/verify-student',
  asyncHandler(async (req, res) => {
    const { schoolCode, studentCode } = studentSchema.parse(req.body);
    const response = await appService.verifyStudent(schoolCode, studentCode);
    res.json(response);
  }),
);

router.post(
  '/student',
  asyncHandler(async (req, res) => {
    const { schoolCode, studentCode } = studentSchema.parse(req.body);
    const response = await appService.verifyStudent(schoolCode, studentCode);
    res.json(response);
  }),
);

const updateSchema = z.object({
  userId: z.string().min(1),
  updates: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    bio: z.string().trim().max(1000).optional(),
    gender: z.enum(['Male', 'Female']).optional(),
    avatar: z.string().url().max(2048).optional(),
  }).strict(),
});

router.put(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId, updates } = updateSchema.parse(req.body);
    const requester = req.auth;
    if (!requester) {
      res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
      return;
    }

    const canEditOtherUsers =
      requester.role === UserRole.ADMIN || requester.role === UserRole.SUPER_ADMIN;
    if (requester.userId !== userId && !canEditOtherUsers) {
      res.status(403).json({ ok: false, data: null, message: 'Cannot update another user profile' });
      return;
    }

    const response = await appService.updateUserProfile(userId, updates);
    res.json(response);
  }),
);

export { router as authRouter };
