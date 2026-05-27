import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/finance/templates
router.get('/templates', async (req, res) => {
  try {
    const { schoolId, term } = req.query;

    const templates = await prisma.feeTemplate.findMany({
      where: {
        schoolId: String(schoolId),
        ...(term ? { term: String(term) } : {}),
      },
      include: {
        lines: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      ok: true,
      data: templates,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: 'Failed to fetch templates',
    });
  }
});

// POST /api/finance/templates
router.post('/templates', async (req, res) => {
  try {
    const {
      schoolId,
      term,
      name,
      scopeType,
      scopeId,
      lines,
    } = req.body;

    const template = await prisma.feeTemplate.create({
      data: {
        schoolId,
        term,
        name,
        scopeType,
        scopeId,

        lines: {
          create: (lines || []).map((line: any, index: number) => ({
            title: line.title,
            key: line.key,
            order: index,
            defaultAmount: line.defaultAmount || 0,
          })),
        },
      },

      include: {
        lines: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    res.json({
      ok: true,
      data: template,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: 'Failed to create template',
    });
  }
});

export default router;
