import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const response = await appService.getSchemes();
    res.json(response);
  }),
);

const uploadSchema = z.object({
  fileName: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

router.post(
  '/upload',
  asyncHandler(async (req, res) => {
    const { fileName, metadata } = uploadSchema.parse(req.body);
    const response = await appService.uploadScheme(fileName, metadata);
    res.json(response);
  }),
);

export { router as schemesRouter };
