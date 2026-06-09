import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const resolveClientIp = (req: Request) => {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const schoolAwareKeyGenerator = (req: Request) => {
  const ip = resolveClientIp(req);
  const schoolId = req.auth?.schoolId ?? 'anonymous';
  return `${schoolId}:${ip}`;
};

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  message: {
    ok: false,
    data: null,
    message: 'Too many authentication attempts. Please try again later.',
  },
});

export const bruteForceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveClientIp,
  message: {
    ok: false,
    data: null,
    message: 'Too many failed attempts from this IP. Please wait before retrying.',
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: schoolAwareKeyGenerator,
  message: {
    ok: false,
    data: null,
    message: 'API rate limit exceeded. Please slow down and try again shortly.',
  },
});
