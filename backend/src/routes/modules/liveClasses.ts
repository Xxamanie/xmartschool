import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const response = await appService.getLiveClasses();
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
  asyncHandler(async (req, res) => {
    const { subjectId, teacherId, scheduledTime, meetingLink } = createSchema.parse(req.body);
    const response = await appService.createLiveClass(subjectId, teacherId, scheduledTime, meetingLink);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/join',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ ok: false, message: 'userId required' });
      return;
    }
    const response = await appService.joinLiveClass(liveClassId, userId);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/leave',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ ok: false, message: 'userId required' });
      return;
    }
    const response = await appService.leaveLiveClass(liveClassId, userId);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/participant-status',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { userId, cameraOn, microphoneOn } = req.body;
    if (!userId) {
      res.status(400).json({ ok: false, message: 'userId required' });
      return;
    }
    const response = await appService.updateParticipantStatus(liveClassId, userId, cameraOn, microphoneOn);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/raise-hand',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { userId, raised } = req.body;
    if (!userId) {
      res.status(400).json({ ok: false, message: 'userId required' });
      return;
    }
    const response = await appService.raiseHand(liveClassId, userId, raised);
    res.json(response);
  }),
);

router.post(
  '/:liveClassId/messages',
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { userId, message } = req.body;
    if (!userId || !message) {
      res.status(400).json({ ok: false, message: 'userId and message required' });
      return;
    }
    const response = await appService.sendLiveClassMessage(liveClassId, userId, message);
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
  asyncHandler(async (req, res) => {
    const { liveClassId } = req.params;
    const { duration } = req.body;
    const response = await appService.stopLiveClassRecording(liveClassId, duration || 0);
    res.json(response);
  }),
);

export { router as liveClassesRouter };
