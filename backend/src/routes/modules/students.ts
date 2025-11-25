import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

const listQuery = z.object({
  schoolId: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { schoolId } = listQuery.parse(req.query);
    const response = await appService.getStudents(schoolId);
    res.json(response);
  }),
);

const updateSchema = z
  .object({
    grade: z.string().optional(),
    status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
  })
  .passthrough();

const idParam = z.object({ id: z.string().min(1) });

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updates = updateSchema.parse(req.body);
    const response = await appService.updateStudent(id, updates);
    res.json(response);
  }),
);

router.get(
  '/form-masters',
  asyncHandler(async (_req, res) => {
    const response = await appService.getClassMasters();
    res.json(response);
  }),
);

const assignSchema = z.object({
  grade: z.string().min(1),
  teacherId: z.string().min(1),
});

router.post(
  '/form-masters',
  asyncHandler(async (req, res) => {
    const { grade, teacherId } = assignSchema.parse(req.body);
    const response = await appService.assignClassMaster(grade, teacherId);
    res.json(response);
  }),
);

export { router as studentsRouter };
