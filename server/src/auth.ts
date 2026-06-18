import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { env } from './env.js';

export const requireAdmin: RequestHandler = (request, response, next) => {
  const supplied = request.header('x-admin-secret') ?? '';
  const expected = env.ADMIN_SECRET;
  const valid = supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!valid) {
    response.status(401).json({ error: 'Unauthorized', message: 'A valid x-admin-secret header is required.' });
    return;
  }
  next();
};
