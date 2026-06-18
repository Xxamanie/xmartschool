import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService, mapSubjectModel } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schoolId = req.auth?.role === UserRole.SUPER_ADMIN ? undefined : req.auth?.schoolId;
    const response = await appService.getSubjects(schoolId);
    res.json(response);
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  teacherId: z.string().optional(),
  schoolId: z.string().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const payload = createSchema.parse(req.body);
    const response = await appService.createSubject({
      ...payload,
      schoolId: payload.schoolId ?? req.auth?.schoolId,
    });
    res.json(response);
  }),
);

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  teacherId: z.string().optional(),
}).strict();

router.put(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const updates = updateSchema.parse(req.body);
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) { res.status(404).json({ ok: false, data: null, message: 'Subject not found' }); return; }
    if (req.auth?.role !== UserRole.SUPER_ADMIN && subject.schoolId !== req.auth?.schoolId) {
      res.status(403).json({ ok: false, data: null, message: 'Forbidden' }); return;
    }
    const updated = await prisma.subject.update({ where: { id }, data: updates });
    res.json({ ok: true, data: mapSubjectModel(updated) });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) { res.status(404).json({ ok: false, data: null, message: 'Subject not found' }); return; }
    if (req.auth?.role !== UserRole.SUPER_ADMIN && subject.schoolId !== req.auth?.schoolId) {
      res.status(403).json({ ok: false, data: null, message: 'Forbidden' }); return;
    }
    await prisma.subject.delete({ where: { id } });
    res.json({ ok: true, data: true });
  }),
);

export { router as subjectsRouter };
