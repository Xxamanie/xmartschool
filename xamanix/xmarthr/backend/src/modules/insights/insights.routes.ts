import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { computeMetrics, computeAttritionRisk, computeLeaveCoverage } from './metrics';
import { llmEnabled, askLlm } from './llm';

const router = Router();
const orgOf = (req: Request): string | null => req.auth?.orgId ?? null;

router.get('/metrics', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const orgId = orgOf(req);
  if (!orgId) return fail(res, 400, 'No organisation context');
  return ok(res, await computeMetrics(orgId));
}));

router.get('/attrition-risk', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const orgId = orgOf(req);
  if (!orgId) return fail(res, 400, 'No organisation context');
  return ok(res, await computeAttritionRisk(orgId));
}));

router.get('/leave-coverage', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const orgId = orgOf(req);
  if (!orgId) return fail(res, 400, 'No organisation context');
  return ok(res, await computeLeaveCoverage(orgId, 14));
}));

router.post('/ask', requireAuth, requireRole('MANAGER'), asyncHandler(async (req, res) => {
  const orgId = orgOf(req);
  if (!orgId) return fail(res, 400, 'No organisation context');
  const { question } = z.object({ question: z.string().min(3).max(500) }).parse(req.body);

  const [org, metrics, risks, coverage] = await Promise.all([
    prisma.org.findUnique({ where: { id: orgId }, select: { name: true, currency: true } }),
    computeMetrics(orgId),
    computeAttritionRisk(orgId),
    computeLeaveCoverage(orgId, 14),
  ]);
  const currency = org?.currency ?? 'NGN';
  const fmt = (m: number | null) => (m == null ? 'n/a' : `${currency} ${(m / 100).toLocaleString('en-NG')}`);
  const highRisk = risks.filter((r) => r.level === 'High').length;

  const snapshot = { org: org?.name, metrics, highAttritionRisk: highRisk, leaveNext14: coverage.upcoming.length, leaveByDepartment: coverage.byDepartment };

  const system =
    'You are a concise HR analyst. Answer using ONLY the JSON metrics provided. Money values are integer minor units (divide by 100). ' +
    'Be specific with numbers, 3-5 sentences. If the data cannot answer, say so plainly.';
  const llmAnswer = await askLlm(system, `Question: ${question}\n\nMetrics JSON:\n${JSON.stringify(snapshot)}`);

  const fallback =
    `Headcount is ${metrics.headcount} (${metrics.active} active, ${metrics.onLeave} on leave). ` +
    `Attrition is ${metrics.attritionRatePct}% with ${highRisk} employee(s) flagged high-risk; punctuality over 30 days is ${metrics.punctualityRatePct}% ` +
    `and the average review rating is ${metrics.avgReviewRating}/5. ` +
    `${coverage.upcoming.length} approved leave period(s) fall in the next 14 days; last finalized payroll net was ${fmt(metrics.lastPayrollNetMinor)}. ` +
    `${metrics.pendingLeave} leave request(s) await a decision. (Configure an AI key for free-form answers.)`;

  return ok(res, { answer: llmAnswer ?? fallback, usedLlm: Boolean(llmAnswer) && llmEnabled(), snapshot });
}));

export const insightsRouter = router;
