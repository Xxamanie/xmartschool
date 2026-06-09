import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

// List conversations for the authenticated user
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId as string;
    const role = req.auth?.role as UserRole;
    const schoolId = req.auth?.schoolId as string | undefined;
    const response = await appService.listConversations(userId, role, schoolId);
    res.json(response);
  }),
);

// Get or create a conversation thread
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const schema = z.object({
      schoolId: z.string().min(1).optional(),
      studentId: z.string().min(1),
      teacherId: z.string().min(1),
      subjectId: z.string().optional(),
    });
    const payload = schema.parse(req.body);
    const effectiveSchoolId = req.auth?.role === UserRole.SUPER_ADMIN
      ? (payload.schoolId ?? '')
      : (req.auth?.schoolId ?? '');
    if (!effectiveSchoolId) {
      res.status(400).json({ ok: false, data: null, message: 'schoolId is required' });
      return;
    }
    const response = await appService.getOrCreateConversation({
      ...payload,
      schoolId: effectiveSchoolId,
      actorId: req.auth?.userId,
      actorRole: req.auth?.role,
    });
    res.json(response);
  }),
);

// Get messages in a conversation
router.get(
  '/:conversationId/messages',
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId as string;
    const role = req.auth?.role as UserRole;
    const response = await appService.getConversationMessages(req.params.conversationId, userId, role);
    res.json(response);
  }),
);

// Send a message in a conversation
router.post(
  '/:conversationId/messages',
  asyncHandler(async (req, res) => {
    const schema = z.object({ content: z.string().min(1).max(5000) });
    const { content } = schema.parse(req.body);
    const userId = req.auth?.userId as string;
    const role = req.auth?.role as UserRole;
    const response = await appService.sendConversationMessage(req.params.conversationId, userId, role, content);
    res.json(response);
  }),
);

export { router as conversationsRouter };
