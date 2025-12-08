import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

const listQuery = z.object({
  subjectId: z.string().optional(),
  term: z.string().optional(),
  studentId: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { subjectId, term, studentId } = listQuery.parse(req.query);
    const response = await appService.getAssessments(subjectId, term, studentId);
    res.json(response);
  }),
);

const assessmentsSchema = z.array(z.any());

router.post(
  '/save',
  asyncHandler(async (req, res) => {
    const assessments = assessmentsSchema.parse(req.body);
    const response = await appService.saveAssessments(assessments as any);
    res.json(response);
  }),
);

export { router as assessmentsRouter };
