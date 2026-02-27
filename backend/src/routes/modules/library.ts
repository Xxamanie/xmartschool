import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { appService } from '../../services/appService';
import { UserRole } from '../../types';

const router = Router();

const listQuery = z.object({
  schoolId: z.string().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { schoolId } = listQuery.parse(req.query);
    const response = await appService.getLibraryMaterials(schoolId);
    res.json(response);
  }),
);

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  fileUrl: z.string().min(1),
  fileType: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  schoolId: z.string().min(1),
  uploadedBy: z.string().min(1),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, description, fileUrl, fileType, fileName, fileSize, schoolId, uploadedBy } = createSchema.parse(req.body);
    const response = await appService.createLibraryMaterial({
      title,
      description,
      fileUrl,
      fileType,
      fileName,
      fileSize: fileSize || 0,
      schoolId,
      uploadedBy,
    });
    res.json(response);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const response = await appService.deleteLibraryMaterial(id);
    res.json(response);
  }),
);

export { router as libraryRouter };
