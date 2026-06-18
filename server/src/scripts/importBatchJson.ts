import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pool } from '../db.js';
import { importBatch } from '../intakeData.js';

const filename = process.argv[2];
if (!filename) throw new Error('Usage: npm run import:batch -- path/to/batch.json');
const cwd = process.cwd();
const attemptedPath = resolve(cwd, filename);
let source: string;
try {
  source = await readFile(attemptedPath, 'utf8');
} catch (error) {
  throw new Error(
    [
      `Unable to read batch import file.`,
      `Current working directory: ${cwd}`,
      `Attempted path: ${attemptedPath}`,
      `For Railway deployments rooted at server/, use: npm run import:batch -- seed/batch_001.json`,
    ].join('\n'),
    { cause: error },
  );
}
const payload = JSON.parse(source) as Record<string, unknown>;
const client = await pool.connect();
try { await client.query('BEGIN'); const result = await importBatch(client, payload); await client.query('COMMIT'); console.log(`Imported ${result.count} entries into ${result.batchKey}.`); }
catch (error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); await pool.end(); }
