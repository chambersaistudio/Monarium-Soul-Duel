import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const migrationsUrl = new URL('../../migrations/', import.meta.url);
const migrationsPath = fileURLToPath(migrationsUrl);
const migrations = (await readdir(migrationsPath)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
for (const migration of migrations) {
  await pool.query(await readFile(new URL(migration, migrationsUrl), 'utf8'));
  console.log(`Applied migration ${migration}`);
}
await pool.end();
