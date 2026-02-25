import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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

const verifyStudent = async (req: Request, res: Response) => {
  const { schoolCode, studentCode } = studentSchema.parse(req.body);
  const response = await appService.verifyStudent(schoolCode, studentCode);
  res.json(response);
};

router.post(
  '/student',
  asyncHandler(verifyStudent),
);

// Backward-compatible alias used by older frontend clients.
router.post(
  '/verify-student',
  asyncHandler(verifyStudent),
);

const updateSchema = z.object({
  userId: z.string().min(1),
  updates: z.record(z.any()),
});

router.put(
  '/profile',
  asyncHandler(async (req, res) => {
    const { userId, updates } = updateSchema.parse(req.body);
    const response = await appService.updateUserProfile(userId, updates);
    res.json(response);
  }),
);

export { router as authRouter };
