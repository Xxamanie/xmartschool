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

const publishSchema = z.union([
  z.array(z.any()),
  z.object({ results: z.array(z.any()) }),
]);

const extractResults = (payload: z.infer<typeof publishSchema>) =>
  Array.isArray(payload) ? payload : payload.results;

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const response = await appService.publishResults(extractResults(payload) as any);
    res.json(response);
  }),
);

router.post(
  '/publish',
  asyncHandler(async (req, res) => {
    const payload = publishSchema.parse(req.body);
    const response = await appService.publishResults(extractResults(payload) as any);
    res.json(response);
  }),
);

export { router as resultsRouter };
