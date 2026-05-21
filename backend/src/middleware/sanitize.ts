import { NextFunction, Request, Response } from 'express';

const blockedKeys = new Set(['__proto__', 'prototype', 'constructor']);

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blockedKeys.has(key) && !key.startsWith('$'))
      .map(([key, nestedValue]) => [key, sanitizeValue(nestedValue)]);

    return Object.fromEntries(sanitizedEntries);
  }

  if (typeof value === 'string') {
    return value.replace(/\0/g, '').trim();
  }

  return value;
};

export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction) => {
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query) as Request['query'];
  req.params = sanitizeValue(req.params) as Request['params'];
  next();
};
