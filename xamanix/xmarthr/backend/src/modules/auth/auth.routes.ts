import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { verifyPassword, signToken } from '../../core/auth';
import { requireAuth } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';

const router = Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { employee: { select: { id: true } } } });
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      return fail(res, 401, 'Invalid email or password');
    }
    const token = signToken({ sub: user.id, role: user.role, orgId: user.orgId, employeeId: user.employee?.id ?? null });
    return ok(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId, employeeId: user.employee?.id ?? null },
    });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.sub },
      select: { id: true, name: true, email: true, role: true, orgId: true, employee: { select: { id: true } } },
    });
    if (!user) return fail(res, 404, 'User not found');
    return ok(res, { id: user.id, name: user.name, email: user.email, role: user.role, orgId: user.orgId, employeeId: user.employee?.id ?? null });
  }),
);

export const authRouter = router;
