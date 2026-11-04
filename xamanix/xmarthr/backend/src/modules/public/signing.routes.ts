import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { readBlob, readBlobBase64 } from '../../core/storage';

/**
 * Public, UNAUTHENTICATED e-signing via a one-time token link. Lets people
 * without a login (new hires, external parties) view, download and sign a
 * specific document. Signing records a tamper-evident hash and, if the document
 * is tied to a checklist step, ticks it automatically.
 */
const router = Router();
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
interface ChecklistItem { title: string; done: boolean; doneAt?: string }

async function loadValidRequest(token: string) {
  const reqRow = await prisma.signatureRequest.findUnique({ where: { token }, include: { document: true } });
  if (!reqRow) return { error: 'Invalid or unknown link' as const };
  if (reqRow.status !== 'Pending') return { error: 'This document has already been signed' as const };
  if (reqRow.expiresAt < new Date()) return { error: 'This signing link has expired' as const };
  return { reqRow };
}

router.get(
  '/sign/:token',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const { reqRow, error } = await loadValidRequest(token);
    if (error) return fail(res, 410, error);
    const org = await prisma.org.findUnique({ where: { id: reqRow!.orgId }, select: { name: true } });
    return ok(res, {
      documentName: reqRow!.document.name,
      mimeType: reqRow!.document.mimeType,
      recipientName: reqRow!.recipientName,
      orgName: org?.name,
      expiresAt: reqRow!.expiresAt,
    });
  }),
);

router.get(
  '/sign/:token/download',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const { reqRow, error } = await loadValidRequest(token);
    if (error) return fail(res, 410, error);
    const buf = await readBlob(reqRow!.document);
    res.setHeader('Content-Type', reqRow!.document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${reqRow!.document.name.replace(/"/g, '')}"`);
    return res.send(buf);
  }),
);

router.post(
  '/sign/:token',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.params);
    const body = z.object({ method: z.enum(['Typed', 'Drawn']), signerName: z.string().min(1), imageBase64: z.string().optional() }).parse(req.body);
    const { reqRow, error } = await loadValidRequest(token);
    if (error) return fail(res, 410, error);
    const doc = reqRow!.document;

    const contentHash = sha256(await readBlobBase64(doc));
    await prisma.signature.create({
      data: { documentId: doc.id, signerName: body.signerName, method: body.method, imageBase64: body.imageBase64, contentHash },
    });
    await prisma.signatureRequest.update({ where: { id: reqRow!.id }, data: { status: 'Signed', signedAt: new Date() } });

    // Auto-tick a linked checklist step.
    if (doc.checklistId && doc.itemIndex != null) {
      const checklist = await prisma.checklist.findUnique({ where: { id: doc.checklistId } });
      if (checklist) {
        const items = (checklist.items as unknown as ChecklistItem[]) ?? [];
        if (doc.itemIndex < items.length) {
          items[doc.itemIndex] = { ...items[doc.itemIndex], done: true, doneAt: new Date().toISOString() };
          const status = items.every((i) => i.done) ? 'Done' : 'Open';
          await prisma.checklist.update({ where: { id: doc.checklistId }, data: { items: items as unknown as object, status } });
        }
      }
    }

    await writeAudit({ orgId: reqRow!.orgId, actorId: null, action: 'PUBLIC_SIGN_DOCUMENT', entity: 'Document', entityId: doc.id, metadata: { hash: contentHash, via: 'email-link' } });
    return ok(res, { signed: true, contentHash }, 'Document signed. Thank you!');
  }),
);

export const signingRouter = router;
