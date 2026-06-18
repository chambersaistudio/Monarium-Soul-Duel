import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const migrationUrl = new URL('../../migrations/001_init.sql', import.meta.url);
await pool.query(await readFile(fileURLToPath(migrationUrl), 'utf8'));
console.log('Applied migration 001_init.sql');
await pool.end();
