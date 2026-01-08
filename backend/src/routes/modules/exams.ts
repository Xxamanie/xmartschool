import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const response = await appService.getExams();
    res.json(response);
  }),
);

router.get(
  '/available',
  asyncHandler(async (_req, res) => {
    const response = await appService.getAvailableExams();
    res.json(response);
  }),
);

const questionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['multiple_choice', 'true_false', 'short_answer', 'essay']),
  text: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  points: z.number().int().positive().default(1),
  isAutoGrade: z.boolean().default(false),
  rubric: z.string().optional(),
});

const examBuilderSchema = z.object({
  examId: z.string().optional(),
  teacherId: z.string().optional(),
  title: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});

router.post(
  '/builder',
  asyncHandler(async (req, res) => {
    const payload = examBuilderSchema.parse(req.body);
    const response = await appService.updateExamQuestions(
      payload.questions,
      payload.title,
      payload.examId,
      payload.teacherId,
    );
    res.json(response);
  }),
);

const statusSchema = z.object({ status: z.enum(['scheduled', 'active', 'ended']) });

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { status } = statusSchema.parse(req.body);
    const response = await appService.setExamStatus(id, status);
    res.json(response);
  }),
);

router.get(
  '/:id/sessions',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const response = await appService.getExamSessions(id);
    res.json(response);
  }),
);

const startSessionSchema = z.object({ studentId: z.string() });

router.post(
  '/:id/sessions/start',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { studentId } = startSessionSchema.parse(req.body);
    const response = await appService.startExamSession(id, studentId);
    res.json(response);
  }),
);

const progressSchema = z.object({
  studentId: z.string(),
  progress: z.number().min(0).max(100),
  answers: z.record(z.string()).optional(),
});

router.post(
  '/:id/sessions/progress',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { studentId, progress, answers } = progressSchema.parse(req.body);
    const response = await appService.updateExamSessionProgress(id, studentId, progress, answers);
    res.json(response);
  }),
);

const submitSchema = z.object({
  studentId: z.string(),
  answers: z.record(z.string()),
  score: z.number().min(0),
});

router.post(
  '/:id/sessions/submit',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { studentId, answers, score } = submitSchema.parse(req.body);
    const response = await appService.submitExam(studentId, answers, score, id);
    res.json(response);
  }),
);

const resetSchema = z.object({ studentId: z.string() });

router.post(
  '/:id/sessions/reset',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { studentId } = resetSchema.parse(req.body);
    const response = await appService.resetStudentExam(id, studentId);
    res.json(response);
  }),
);

export { router as examsRouter };
