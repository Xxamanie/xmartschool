import { Router, Request } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { writeAudit } from '../../core/audit';
import { storeBlob, readBlob, readBlobBase64 } from '../../core/storage';
import { env } from '../../core/env';
import { sendEmail, emailEnabled } from '../notifications/email.service';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// Metadata projection (never ship the blob in lists).
const META = {
  id: true, orgId: true, employeeId: true, checklistId: true, itemIndex: true,
  name: true, mimeType: true, sizeBytes: true, requiresSignature: true, createdAt: true,
  signatures: { select: { id: true, signerName: true, method: true, signedAt: true } },
} as const;

interface ChecklistItem { title: string; done: boolean; doneAt?: string }

// ── Upload (HR) ───────────────────────────────────────────────────────────--
router.post(
  '/',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const body = z.object({
      employeeId: z.string().optional(),
      checklistId: z.string().optional(),
      itemIndex: z.number().int().min(0).optional(),
      name: z.string().min(1),
      mimeType: z.string().optional(),
      contentBase64: z.string().min(1),
      requiresSignature: z.boolean().optional(),
    }).parse(req.body);

    const sizeBytes = Math.floor((body.contentBase64.length * 3) / 4);
    const mime = body.mimeType ?? 'application/octet-stream';
    const stored = await storeBlob(body.contentBase64, mime); // db (base64) or s3 (object)
    const doc = await prisma.document.create({
      data: {
        orgId, employeeId: body.employeeId, checklistId: body.checklistId, itemIndex: body.itemIndex,
        name: body.name, mimeType: mime, sizeBytes,
        storageDriver: stored.driver, storageKey: stored.storageKey, contentBase64: stored.contentBase64,
        requiresSignature: body.requiresSignature ?? false, uploadedById: req.auth!.sub,
      },
      select: META,
    });
    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'UPLOAD_DOCUMENT', entity: 'Document', entityId: doc.id });
    return ok(res, doc, 'Document uploaded');
  }),
);

// ── Lists ─────────────────────────────────────────────────────────────────--
router.get(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    if (!orgId) return fail(res, 400, 'No organisation context');
    const q = z.object({ employeeId: z.string().optional(), checklistId: z.string().optional() }).parse(req.query);
    const documents = await prisma.document.findMany({
      where: { orgId, ...(q.employeeId ? { employeeId: q.employeeId } : {}), ...(q.checklistId ? { checklistId: q.checklistId } : {}) },
      select: META, orderBy: { createdAt: 'desc' }, take: 300,
    });
    return ok(res, documents);
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.auth!.employeeId;
    if (!employeeId) return fail(res, 404, 'No employee profile linked to this account');
    const documents = await prisma.document.findMany({ where: { employeeId }, select: META, orderBy: { createdAt: 'desc' } });
    return ok(res, documents);
  }),
);

// ── Download (HR or owner) ────────────────────────────────────────────────--
router.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return fail(res, 404, 'Document not found');
    const role = req.auth!.role;
    const isAdmin = role === 'OWNER' || role === 'HR_ADMIN' || role === 'MANAGER';
    if (!isAdmin && req.auth!.employeeId !== doc.employeeId) return fail(res, 403, 'Forbidden');
    if (doc.orgId !== req.auth!.orgId) return fail(res, 403, 'Forbidden');

    const buf = await readBlob(doc);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.name.replace(/"/g, '')}"`);
    return res.send(buf);
  }),
);

// ── Sign (HR or owner) — records signer, timestamp and a content hash ─────--
router.post(
  '/:id/sign',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({ method: z.enum(['Typed', 'Drawn']), signerName: z.string().min(1), imageBase64: z.string().optional() }).parse(req.body);

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return fail(res, 404, 'Document not found');
    const role = req.auth!.role;
    const isAdmin = role === 'OWNER' || role === 'HR_ADMIN' || role === 'MANAGER';
    if (!isAdmin && req.auth!.employeeId !== doc.employeeId) return fail(res, 403, 'Forbidden');
    if (doc.orgId !== req.auth!.orgId) return fail(res, 403, 'Forbidden');

    const contentHash = sha256(await readBlobBase64(doc));
    const signature = await prisma.signature.create({
      data: { documentId: id, signerUserId: req.auth!.sub, signerEmployeeId: req.auth!.employeeId, signerName: body.signerName, method: body.method, imageBase64: body.imageBase64, contentHash },
    });

    // Automation: signing a document tied to a checklist item ticks that item.
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

    await writeAudit({ orgId: doc.orgId, actorId: req.auth!.sub, action: 'SIGN_DOCUMENT', entity: 'Document', entityId: id, metadata: { signatureId: signature.id, hash: signature.contentHash } });
    return ok(res, { id: signature.id, signerName: signature.signerName, signedAt: signature.signedAt, contentHash: signature.contentHash }, 'Document signed');
  }),
);

router.get(
  '/:id/signatures',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const doc = await prisma.document.findUnique({ where: { id }, select: { orgId: true, employeeId: true } });
    if (!doc) return fail(res, 404, 'Document not found');
    const role = req.auth!.role;
    const isAdmin = role === 'OWNER' || role === 'HR_ADMIN' || role === 'MANAGER';
    if (!isAdmin && req.auth!.employeeId !== doc.employeeId) return fail(res, 403, 'Forbidden');
    const signatures = await prisma.signature.findMany({ where: { documentId: id }, select: { id: true, signerName: true, method: true, signedAt: true, contentHash: true }, orderBy: { signedAt: 'asc' } });
    return ok(res, signatures);
  }),
);

// ── Email e-sign request (to someone without a login) ─────────────────────--
router.post(
  '/:id/sign-requests',
  requireAuth,
  requireRole(),
  asyncHandler(async (req, res) => {
    const orgId = orgOf(req);
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z.object({ recipientEmail: z.string().email(), recipientName: z.string().optional(), expiresInDays: z.number().int().min(1).max(90).optional() }).parse(req.body);

    const doc = await prisma.document.findFirst({ where: { id, orgId: orgId ?? undefined }, select: { id: true, name: true } });
    if (!doc) return fail(res, 404, 'Document not found');

    const expiresAt = new Date(Date.now() + (body.expiresInDays ?? 14) * 86_400_000);
    const request = await prisma.signatureRequest.create({
      data: { orgId: orgId!, documentId: id, recipientEmail: body.recipientEmail, recipientName: body.recipientName, expiresAt, createdById: req.auth!.sub },
    });
    const url = `${env.publicBaseUrl}/sign/${request.token}`;
    const emailed = (await sendEmail(
      body.recipientEmail,
      `Please sign: ${doc.name}`,
      `<p>Hello${body.recipientName ? ' ' + body.recipientName : ''},</p><p>You have been asked to review and sign <b>${doc.name}</b>.</p><p><a href="${url}">Open and sign the document</a> (link expires ${expiresAt.toDateString()}).</p>`,
    )).sent;

    await writeAudit({ orgId, actorId: req.auth!.sub, action: 'CREATE_SIGN_REQUEST', entity: 'SignatureRequest', entityId: request.id, metadata: { emailed } });
    return ok(res, { token: request.token, url, emailed, emailConfigured: emailEnabled() }, emailed ? 'Signature request emailed' : 'Signature request created — share the link');
  }),
);

export const documentsRouter = router;
