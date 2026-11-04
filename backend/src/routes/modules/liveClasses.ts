import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';
import { enforceTenantQuery, getEffectiveSchoolId } from '../../utils/tenant';

const router = Router();
router.use(requireAuth, enforceTenantQuery, requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT, UserRole.SUPER_ADMIN));

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth;
    const response = await appService.getLiveClasses(
      getEffectiveSchoolId(req),
      auth?.userId,
      auth?.role,
      auth?.role === UserRole.STUDENT ? auth.userId : undefined,
    );
    res.json(response);
  }),
);

const createSchema = z.object({
  subjectId: z.string().optional(),
  teacherId: z.string().optional(),
  schoolClassId: z.string().min(1),
  scheduledTime: z.string().refine(value => Number.isFinite(Date.parse(value)), 'Scheduled time must be a valid date and time'),
  meetingLink: z.string().trim().max(2048).refine(value => {
    if (!value) return true;
    try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
  }, 'Meeting link must be an HTTP or HTTPS URL').default(''),
});



router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { subjectId, teacherId, schoolClassId, scheduledTime, meetingLink } = createSchema.parse(req.body);
    const preferredTeacherId = req.auth?.role === UserRole.TEACHER ? req.auth.userId : teacherId;
    const response = await appService.createLiveClass(subjectId, preferredTeacherId, schoolClassId, scheduledTime, meetingLink, {
      userId: req.auth!.userId, role: req.auth!.role, schoolId: getEffectiveSchoolId(req),
    });

    res.json(response);
  }),
);

router.post(
  '/:liveClassId/join',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.joinLiveClass(liveClassId, req.auth!.userId, req.auth!.role, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/leave',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.leaveLiveClass(liveClassId, req.auth!.userId, req.auth!.role, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/participant-status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { cameraOn, microphoneOn } = z.object({ cameraOn: z.boolean(), microphoneOn: z.boolean() }).parse(req.body);
    const response = await appService.updateParticipantStatus(liveClassId, req.auth!.userId, req.auth!.role, cameraOn, microphoneOn, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/raise-hand',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { raised } = z.object({ raised: z.boolean() }).parse(req.body);
    const response = await appService.raiseHand(liveClassId, req.auth!.userId, req.auth!.role, raised, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

const messageSchema = z.object({ message: z.string().min(1).max(2000) });

router.post(
  '/:liveClassId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { message } = messageSchema.parse(req.body);
    const response = await appService.sendLiveClassMessage(liveClassId, req.auth!.userId, req.auth!.role, message, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

router.get(
  '/:liveClassId/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.getLiveClassMessages(liveClassId, req.auth!.userId, req.auth!.role, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

router.get(
  '/:liveClassId/participants',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.getLiveClassParticipants(liveClassId, req.auth!.userId, req.auth!.role, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

const recordingStartSchema = z.object({ recordingUrl: z.string().url().max(2048) });

router.post(
  '/:liveClassId/recording/start',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { recordingUrl } = recordingStartSchema.parse(req.body);
    const response = await appService.startLiveClassRecording(liveClassId, recordingUrl, req.auth!.userId, req.auth!.role, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/recording/stop',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { duration } = z.object({ duration: z.number().nonnegative().default(0) }).parse(req.body);
    const response = await appService.stopLiveClassRecording(liveClassId, duration, req.auth!.userId, req.auth!.role, getEffectiveSchoolId(req));
    res.json(response);
  }),
);

export { router as liveClassesRouter };
