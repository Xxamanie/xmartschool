import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const response = await appService.getLiveClasses(req.auth?.schoolId);
    res.json(response);
  }),
);

const createSchema = z.object({
  subjectId: z.string().optional(),
  teacherId: z.string().optional(),
  scheduledTime: z.string().min(1),
  meetingLink: z.string().min(1),
});

router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { subjectId, teacherId, scheduledTime, meetingLink } = createSchema.parse(req.body);
    const preferredTeacherId = req.auth?.role === UserRole.TEACHER ? req.auth.userId : teacherId;
    const response = await appService.createLiveClass(subjectId, preferredTeacherId, scheduledTime, meetingLink);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/join',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.joinLiveClass(liveClassId, req.auth!.userId);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/leave',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.leaveLiveClass(liveClassId, req.auth!.userId);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/participant-status',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { cameraOn, microphoneOn } = req.body;
    const response = await appService.updateParticipantStatus(liveClassId, req.auth!.userId, cameraOn, microphoneOn);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/raise-hand',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { raised } = req.body;
    const response = await appService.raiseHand(liveClassId, req.auth!.userId, raised);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/messages',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ ok: false, message: 'message required' });
      return;
    }
    const response = await appService.sendLiveClassMessage(liveClassId, req.auth!.userId, message);
    res.json(response);
  }),
);

router.get(
  '/:liveClassId/messages',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.getLiveClassMessages(liveClassId);
    res.json(response);
  }),
);

router.get(
  '/:liveClassId/participants',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const response = await appService.getLiveClassParticipants(liveClassId);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/recording/start',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { recordingUrl } = req.body;
    if (!recordingUrl) {
      res.status(400).json({ ok: false, message: 'recordingUrl required' });
      return;
    }
    const response = await appService.startLiveClassRecording(liveClassId, recordingUrl);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/recording/stop',
  requireRole(UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { duration } = req.body;
    const response = await appService.stopLiveClassRecording(liveClassId, duration || 0);
    res.json(response);
  }),
);

export { router as liveClassesRouter };
