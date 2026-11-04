import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';
import { defaultPreferences, preferenceKeys } from '../../services/notificationPolicy';
import { UserRole } from '../../types';

export const preferencesRouter = Router();
preferencesRouter.use(requireAuth);
const schema = z.object({ preferences: z.object(Object.fromEntries(preferenceKeys.map(key => [key, z.boolean()])) as Record<typeof preferenceKeys[number], z.ZodBoolean>).strict() }).strict();
preferencesRouter.get('/', asyncHandler(async (req, res) => {
  const row = req.auth!.role === UserRole.STUDENT
    ? await prisma.student.findUnique({ where: { id: req.auth!.userId }, select: { notificationPreferences: true } })
    : await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { notificationPreferences: true } });
  res.json({ ok: true, data: { preferences: { ...defaultPreferences, ...(row?.notificationPreferences as object ?? {}) } } });
}));
preferencesRouter.put('/', asyncHandler(async (req, res) => {
  const { preferences } = schema.parse(req.body);
  if (req.auth!.role === UserRole.STUDENT) await prisma.student.update({ where: { id: req.auth!.userId }, data: { notificationPreferences: preferences } });
  else await prisma.user.update({ where: { id: req.auth!.userId }, data: { notificationPreferences: preferences } });
  res.json({ ok: true, data: { preferences } });
}));
