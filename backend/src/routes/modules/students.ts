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
    house: z.string().optional(),
    status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
  })
  .passthrough();

const idParam = z.object({ id: z.string().min(1) });

const createSchema = z.object({
  name: z.string().min(1),
  gender: z.string().min(1),
  grade: z.string().min(1),
  house: z.string().min(1),
  status: z.enum(['Active', 'Inactive', 'Suspended']).optional(),
  gpa: z.number().optional(),
  attendance: z.number().optional(),
  schoolId: z.string().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.createStudent(payload as any);
    res.json(response);
  }),
);

const promoteSchema = z.object({
  schoolId: z.string().optional(),
  term: z.string().min(1),
  year: z.number().int(),
  nextGradeByCurrent: z.record(z.string(), z.string()).optional(),
  graduatingGrades: z.array(z.string()).optional(),
  eligibleStudentIds: z.array(z.string()).optional(),
});

router.post(
  '/promote',
  asyncHandler(async (req, res) => {
    const payload = promoteSchema.parse(req.body);
    const response = await appService.promoteStudents(payload);
    res.json(response);
  }),
);

const graduatedQuery = z.object({
  schoolId: z.string().optional(),
  level: z.string().optional(),
  year: z.coerce.number().int().optional(),
  term: z.string().optional(),
});

router.get(
  '/graduated',
  asyncHandler(async (req, res) => {
    const filters = graduatedQuery.parse(req.query);
    const response = await appService.getGraduatedStudents(filters);
    res.json(response);
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updates = updateSchema.parse(req.body);
    const response = await appService.updateStudent(id, updates);
    res.json(response);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const response = await appService.deleteStudent(id);
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
