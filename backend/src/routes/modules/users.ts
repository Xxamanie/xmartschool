import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const response = await appService.getAllUsers();
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'TEACHER']).optional(),
  avatar: z.string().optional(),
  gender: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
  schoolId: z.string().optional(),
  formClass: z.string().optional(),
  house: z.string().optional(),
  subjectIds: z.array(z.string()).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.createTeacher(payload as any);
    res.json(response);
  }),
);

router.get(
  '/house-masters',
  asyncHandler(async (_req, res) => {
    const response = await appService.getHouseMasters();
    res.json(response);
  }),
);

const houseAssignSchema = z.object({
  house: z.string().min(1),
  teacherId: z.string().min(1),
});

router.post(
  '/house-masters',
  asyncHandler(async (req, res) => {
    const { house, teacherId } = houseAssignSchema.parse(req.body);
    const response = await appService.assignHouseMaster(house, teacherId);
    res.json(response);
  }),
);

const idParam = z.object({ id: z.string().min(1) });
const updateSchema = z
  .object({
    name: z.string().optional(),
    phone: z.string().optional(),
    bio: z.string().optional(),
    gender: z.string().optional(),
    formClass: z.string().optional(),
    house: z.string().optional(),
    subjectIds: z.array(z.string()).optional(),
  })
  .passthrough();

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const updates = updateSchema.parse(req.body);
    const response = await appService.updateUserProfile(id, updates as any);
    res.json(response);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const response = await appService.deleteUser(id);
    res.json(response);
  }),
);

export { router as usersRouter };
