import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const migrationsUrl = new URL('../migrations/', import.meta.url);
const migrationLockId = 684271901;

export async function applyMigrations(pool: Pool): Promise<string[]> {
  const migrationsPath = fileURLToPath(migrationsUrl);
  const migrations = (await readdir(migrationsPath)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    for (const migration of migrations) {
      await client.query(await readFile(new URL(migration, migrationsUrl), 'utf8'));
    }
    return migrations;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [migrationLockId]).catch(() => undefined);
    client.release();
  }
}
