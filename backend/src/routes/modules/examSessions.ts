import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { examId } = z.object({ examId: z.string().min(1) }).parse(req.query);
    const response = await appService.getExamSessions(examId);
    res.json(response);
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { examId, studentId } = z.object({
      examId: z.string().min(1),
      studentId: z.string().min(1),
    }).parse(req.body);

    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const response = await appService.startExamSession(examId, effectiveStudentId);
    res.json(response);
  }),
);

router.patch(
  '/:examId/:studentId/progress',
  asyncHandler(async (req, res) => {
    const { examId, studentId } = z.object({
      examId: z.string().min(1),
      studentId: z.string().min(1),
    }).parse(req.params);

    const { progress, answers } = z.object({
      progress: z.number().min(0).max(100),
      answers: z.record(z.string()).optional(),
    }).parse(req.body);

    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const response = await appService.updateExamSessionProgress(examId, effectiveStudentId, progress, answers);
    res.json(response);
  }),
);

router.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const { examId, studentId, answers, score } = z.object({
      examId: z.string().optional(),
      studentId: z.string().min(1),
      answers: z.record(z.string()),
      score: z.number().min(0),
    }).parse(req.body);

    const effectiveStudentId = req.auth?.role === UserRole.STUDENT ? req.auth.userId : studentId;
    const response = await appService.submitExam(effectiveStudentId, answers, score, examId);
    res.json(response);
  }),
);

router.delete(
  '/:examId/:studentId',
  asyncHandler(async (req, res) => {
    const { examId, studentId } = z.object({
      examId: z.string().min(1),
      studentId: z.string().min(1),
    }).parse(req.params);

    const response = await appService.resetStudentExam(examId, studentId);
    res.json(response);
  }),
);

export { router as examSessionsRouter };
