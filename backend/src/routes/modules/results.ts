import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

const listQuery = z.object({
  studentId: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { studentId } = listQuery.parse(req.query);
    const response = await appService.getResults(studentId);
    res.json(response);
  }),
);

const publishSchema = z.array(z.any());

router.post(
  '/publish',
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const response = await appService.publishResults(payload as any);
    res.json(response);
  }),
);

export { router as resultsRouter };
