import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { appService } from '../services/appService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const response = await appService.health();
    res.json(response);
  }),
);

export { router as healthRouter };
