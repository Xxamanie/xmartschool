import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

router.get(
  '/smoke',
  asyncHandler(async (_req, res) => {
    const response = await appService.logAIActivity({
      action: 'ai_activity_smoke_test',
      scope: 'general',
      status: 'success',
      metadata: { source: 'http_smoke' },
    });
    res.json(response);
  }),
);

export { router as aiActivitySmokeRouter };
