import { RequestHandler, Router } from 'express';
import { subscribeMessageEvents } from '../../services/eventBus';
import { UserRole } from '../../types';

export const eventStreamRouter = Router();
export const messageStreamHandler: RequestHandler = (req, res) => {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ ok: false, data: null, message: 'Authentication required' });
    return;
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  let closed = false;
  const write = (frame: string) => {
    if (closed || res.writableEnded || res.destroyed) return;
    // Slow consumers reconnect and reload their inbox instead of buffering indefinitely.
    if (!res.write(frame)) res.end();
  };
  const unsubscribe = subscribeMessageEvents(event => {
    const sameSchool = !auth.schoolId || event.schoolId === auth.schoolId;
    const allowed = event.type === 'private-message'
      ? sameSchool && event.userIds?.includes(auth.userId)
      : event.schoolId === auth.schoolId && [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN].includes(auth.role);
    if (allowed) {
      write(`event: message\ndata: ${JSON.stringify({ type: event.type, conversationId: event.conversationId })}\n\n`);
    }
  });
  const heartbeat = setInterval(() => write(': heartbeat\n\n'), 25000);
  // Reconnect periodically to revalidate the session rather than holding expired credentials.
  const expiry = setTimeout(() => res.end(), 5 * 60 * 1000);
  const cleanup = () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
    clearTimeout(expiry);
  };
  res.once('close', cleanup);
  res.once('finish', cleanup);
  write('event: ready\ndata: {}\n\n');
};

eventStreamRouter.get('/stream', messageStreamHandler);
