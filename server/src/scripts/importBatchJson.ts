import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../db.js';
import { importBatch } from '../intakeData.js';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: npm run import:batch -- path/to/batch.json');
const payload = JSON.parse(await readFile(resolve(process.cwd(), filename), 'utf8')) as Record<string, unknown>;
const client = await pool.connect();
try { await client.query('BEGIN'); const result = await importBatch(client, payload); await client.query('COMMIT'); console.log(`Imported ${result.count} entries into ${result.batchKey}.`); }
catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
