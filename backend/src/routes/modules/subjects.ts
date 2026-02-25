import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const response = await appService.getSubjects();
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  teacherId: z.string().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body) as { name: string; teacherId?: string };
    const response = await appService.createSubject(payload);
    res.json(response);
  }),
);

export { router as subjectsRouter };
