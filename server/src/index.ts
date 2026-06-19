import express from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { corsOrigins, env } from './env.js';
import { healthRouter } from './routes/health.js';
import { intakeRouter } from './routes/intake.js';
import { uploadsRouter } from './routes/uploads.js';
import { codexRouter } from './routes/codex.js';
import { pool } from './db.js';
import { applyMigrations } from './migrations.js';

const app = express();
const appliedMigrations = await applyMigrations(pool);
console.log(`Database schema ready (${appliedMigrations.join(', ')})`);
app.disable('x-powered-by');
app.use(cors({ origin(origin, callback) { callback(null, !origin || corsOrigins.some(pattern => originMatches(origin, pattern))); }, allowedHeaders: ['Content-Type','x-admin-secret'], methods: ['GET','POST','PUT','PATCH','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use('/health', healthRouter);
app.use('/api/intake', intakeRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/codex', codexRouter);
app.use((_request, response) => response.status(404).json({ error: 'Not found' }));
app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof ZodError) { response.status(400).json({ error: 'Invalid request', details: error.flatten() }); return; }
  response.status(500).json({ error: 'Internal server error' });
});
app.listen(env.PORT, () => console.log(`Monarium Studio API listening on port ${env.PORT}`));

function originMatches(origin: string, pattern: string): boolean {
  if (origin === pattern) return true;
  if (!pattern.includes('*')) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(origin);
}
