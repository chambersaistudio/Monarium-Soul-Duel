import { Router, type NextFunction, type Request, type Response } from 'express';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';
import { editablePatch, importBatch } from '../intakeData.js';

export const intakeRouter = Router();
intakeRouter.use(requireAdmin);

intakeRouter.get('/batches', async (_request, response, next) => {
  try { const result = await pool.query('SELECT * FROM monari_intake_batches ORDER BY imported_at DESC, created_at DESC'); response.json({ batches: result.rows }); } catch (error) { next(error); }
});
intakeRouter.get('/batches/:batchKey', async (request, response, next) => {
  try {
    const batchResult = await pool.query('SELECT * FROM monari_intake_batches WHERE batch_key=$1', [request.params.batchKey]);
    if (!batchResult.rowCount) { response.status(404).json({ error: 'Batch not found' }); return; }
    const batch = batchResult.rows[0];
    const entries = await pool.query('SELECT * FROM monari_intake_entries WHERE batch_id=$1 ORDER BY created_at, entry_key', [batch.id]);
    response.json({ ...batch, entries: entries.rows });
  } catch (error) { next(error); }
});
intakeRouter.post('/import-json', async (request, response, next) => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await importBatch(client, request.body as Record<string, unknown>); await client.query('COMMIT'); response.status(201).json(result); }
  catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});
async function updateEntry(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const patch = editablePatch(request.body); const columns = Object.keys(patch);
    if (!columns.length) { response.status(400).json({ error: 'No editable fields supplied' }); return; }
    const values = Object.values(patch); const assignments = columns.map((column, index) => `${column}=$${index + 2}`).join(',');
    const result = await pool.query(`UPDATE monari_intake_entries SET ${assignments},updated_at=NOW() WHERE id=$1 RETURNING *`, [request.params.entryId, ...values]);
    if (!result.rowCount) { response.status(404).json({ error: 'Entry not found' }); return; }
    response.json({ entry: result.rows[0] });
  } catch (error) { next(error); }
}
intakeRouter.patch('/entries/:entryId', updateEntry);
intakeRouter.put('/entries/:entryId', updateEntry);
intakeRouter.post('/entries/:entryId/asset', async (request, response, next) => {
  try {
    const { objectKey, publicUrl } = request.body as { objectKey?: unknown; publicUrl?: unknown };
    if (typeof objectKey !== 'string' || typeof publicUrl !== 'string') { response.status(400).json({ error: 'objectKey and publicUrl are required' }); return; }
    const result = await pool.query('UPDATE monari_intake_entries SET image_path=$2,image_url=$3,pending_image_path=NULL,asset_status=$4,updated_at=NOW() WHERE id=$1 RETURNING *', [request.params.entryId, objectKey, publicUrl, 'ready']);
    if (!result.rowCount) { response.status(404).json({ error: 'Entry not found' }); return; }
    response.json({ entry: result.rows[0] });
  } catch (error) { next(error); }
});
