import { Request, Response, NextFunction } from 'express';

/** Wrap an async route so thrown errors reach the Express error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

export const ok = <T>(res: Response, data: T, message?: string) =>
  res.json({ ok: true, data, message });

export const fail = (res: Response, status: number, message: string) =>
  res.status(status).json({ ok: false, data: null, message });
