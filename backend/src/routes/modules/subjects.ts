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
    const response = schoolId ? await appService.getSubjectsBySchool(schoolId) : await appService.getSubjects();
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

const idParam = z.object({ id: z.string().min(1) });
const updateSchema = z
  .object({
    name: z.string().optional(),
    teacherId: z.string().nullable().optional(),
    schedule: z.string().optional(),
    room: z.string().optional(),
  })
  .passthrough();

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updates = updateSchema.parse(req.body);
    const response = await appService.updateSubject(id, updates as any);
    res.json(response);
  }),
);

export { router as subjectsRouter };
