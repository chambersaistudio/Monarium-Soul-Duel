import { Router } from 'express';
import { checkDatabase } from '../db.js';

export const healthRouter = Router();
healthRouter.get('/', async (_request, response) => {
  try {
    await checkDatabase();
    response.json({ status: 'ok', service: 'monarium-studio-api', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    response.status(503).json({ status: 'degraded', service: 'monarium-studio-api', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});
