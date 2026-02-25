import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

const getSchema = z.object({
  date: z.string().min(1),
  grade: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { date, grade } = getSchema.parse(req.query);
    const response = await appService.getAttendance(date, grade);
    res.json(response);
  }),
);

const markSchema = z.array(
  z.object({
    studentId: z.string().min(1),
    status: z.enum(['Present', 'Absent', 'Late', 'Excused']),
    date: z.string().min(1),
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = markSchema.parse(req.body) as {
      studentId: string;
      status: 'Present' | 'Absent' | 'Late' | 'Excused';
      date: string;
    }[];
    const response = await appService.markAttendance(payload);
    res.json(response);
  }),
);

export { router as attendanceRouter };
