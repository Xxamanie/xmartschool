import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

const frameSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  frameData: z.string().min(1),
});

router.post(
  '/frame',
  asyncHandler(async (req, res) => {
    const { examId, studentId, frameData } = frameSchema.parse(req.body);
    const response = await appService.recordProctorFrame(examId, studentId, frameData);
    res.json(response);
  }),
);

export { router as proctoringRouter };
