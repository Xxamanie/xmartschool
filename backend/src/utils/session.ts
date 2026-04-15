import crypto from 'crypto';
import { User, UserRole } from '../types';

type SessionPayload = {
  sub: string;
  role: UserRole;
  schoolId?: string;
  exp: number;
};

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'smart-school-dev-session-secret';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const sign = (value: string) =>
  crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');

export const createSessionToken = (user: User): string => {
  const payload: SessionPayload = {
    sub: user.id,
    role: user.role,
    schoolId: user.schoolId,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encodedPayload = encode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifySessionToken = (token: string): SessionPayload | null => {
  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as SessionPayload;
    if (!payload.sub || !payload.role || typeof payload.exp !== 'number' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export type { SessionPayload };
