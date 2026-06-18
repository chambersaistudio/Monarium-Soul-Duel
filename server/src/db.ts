import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function checkDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}
