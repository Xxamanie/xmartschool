import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../core/prisma';
import { requireAuth, requireRole } from '../../core/rbac';
import { asyncHandler, ok, fail } from '../../core/http';
import { computeMetrics, computeForecast, computeNoShowRisk } from './metrics';
import { llmEnabled, askLlm } from './llm';

const router = Router();
const propertyOf = (req: Request): string | null => req.auth?.propertyId ?? null;
const DAY = 86_400_000;
const isValidDate = (s: string) => !isNaN(new Date(s).getTime());

router.get(
  '/metrics',
  requireAuth,
  requireRole('ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const q = z.object({ from: z.string().optional(), to: z.string().optional(), compare: z.string().optional() }).parse(req.query);
    const to = q.to && isValidDate(q.to) ? new Date(q.to) : new Date();
    const from = q.from && isValidDate(q.from) ? new Date(q.from) : new Date(to.getTime() - 30 * DAY);

    const current = await computeMetrics(propertyId, from, to);
    let previous = null;
    if (q.compare === 'true') {
      const span = to.getTime() - from.getTime();
      previous = await computeMetrics(propertyId, new Date(from.getTime() - span), from);
    }
    return ok(res, { current, previous });
  }),
);

router.get(
  '/forecast',
  requireAuth,
  requireRole('ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 60);
    return ok(res, await computeForecast(propertyId, days));
  }),
);

router.get(
  '/no-show-risk',
  requireAuth,
  requireRole('ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    return ok(res, await computeNoShowRisk(propertyId));
  }),
);

// ── Natural-language question over the property's own metrics ─────────────────
router.post(
  '/ask',
  requireAuth,
  requireRole('ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const propertyId = propertyOf(req);
    if (!propertyId) return fail(res, 400, 'No property context');
    const { question } = z.object({ question: z.string().min(3).max(500) }).parse(req.body);

    const now = new Date();
    const [property, current, previous, forecast, risks] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, currency: true } }),
      computeMetrics(propertyId, new Date(now.getTime() - 30 * DAY), now),
      computeMetrics(propertyId, new Date(now.getTime() - 60 * DAY), new Date(now.getTime() - 30 * DAY)),
      computeForecast(propertyId, 14),
      computeNoShowRisk(propertyId),
    ]);
    const currency = property?.currency ?? 'NGN';
    const fmt = (m: number) => `${currency} ${(m / 100).toLocaleString('en-NG')}`;

    const avgFcOcc = forecast.length ? Math.round(forecast.reduce((s, d) => s + d.occupancy, 0) / forecast.length * 10) / 10 : 0;
    const highRisk = risks.filter((r) => r.level === 'High').length;

    const snapshot = {
      property: property?.name,
      last30Days: current,
      prior30Days: previous,
      next14DaysAvgOccupancy: avgFcOcc,
      highNoShowRisk: highRisk,
    };

    // Try the LLM; fall back to a deterministic summary.
    const system =
      'You are a concise hotel revenue analyst. Answer the user question using ONLY the JSON metrics provided. ' +
      'Money values are in integer minor units (divide by 100). Be specific with numbers and short (3-5 sentences). ' +
      'If the data cannot answer the question, say so plainly.';
    const userPrompt = `Question: ${question}\n\nMetrics JSON:\n${JSON.stringify(snapshot)}`;
    const llmAnswer = await askLlm(system, userPrompt);

    const occDelta = previous.occupancyRate ? Math.round((current.occupancyRate - previous.occupancyRate) * 10) / 10 : current.occupancyRate;
    const fallback =
      `In the last 30 days: ${current.occupancyRate}% occupancy (${occDelta >= 0 ? '+' : ''}${occDelta}pts vs the prior 30 days), ` +
      `ADR ${fmt(current.adrMinor)}, RevPAR ${fmt(current.revparMinor)}, ${fmt(current.revenueCollectedMinor)} collected across ${current.bookings} new bookings ` +
      `(${current.cancellations} cancellations, ${current.noShows} no-shows). ` +
      `Looking ahead, average projected occupancy over the next 14 nights is ${avgFcOcc}%, with ${highRisk} high no-show-risk arrival(s) to confirm. ` +
      `(Configure an AI key for narrative answers to free-form questions.)`;

    return ok(res, { answer: llmAnswer ?? fallback, usedLlm: Boolean(llmAnswer) && llmEnabled(), snapshot });
  }),
);

export const insightsRouter = router;
