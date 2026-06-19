import { Router, type NextFunction, type Request, type Response } from 'express';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';
import { editablePatch, importBatch, IntakeValidationError } from '../intakeData.js';
import { publicUrl as r2PublicUrl } from '../r2.js';

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
  } catch (error) {
    if (error instanceof IntakeValidationError) {
      response.status(400).json({ error: error.message, field: error.field });
      return;
    }
    const databaseError = error as { code?: string; constraint?: string; column?: string };
    console.error('Intake update failed', {
      entryId: request.params.entryId,
      fields: Object.keys(request.body && typeof request.body === 'object' ? editablePatch(request.body) : {}),
      code: databaseError.code,
      constraint: databaseError.constraint,
      column: databaseError.column,
    });
    if (databaseError.code?.startsWith('22') || databaseError.code?.startsWith('23')) {
      response.status(400).json({
        error: databaseError.constraint ? `Value violates ${databaseError.constraint}` : 'One or more fields contain an invalid value',
        field: databaseError.column,
      });
      return;
    }
    next(error);
  }
}
intakeRouter.patch('/entries/:entryId', updateEntry);
intakeRouter.put('/entries/:entryId', updateEntry);
intakeRouter.post('/entries/:entryId/asset', async (request, response, next) => {
  try {
    const { assetKind, objectKey, publicUrl } = request.body as { assetKind?: unknown; objectKey?: unknown; publicUrl?: unknown };
    if (assetKind !== 'profile' || typeof objectKey !== 'string' || typeof publicUrl !== 'string') {
      response.status(400).json({ error: 'assetKind profile, objectKey, and publicUrl are required' }); return;
    }
    if (publicUrl !== r2PublicUrl(objectKey)) { response.status(400).json({ error: 'publicUrl does not match the R2 object key' }); return; }
    const result = await pool.query(`UPDATE monari_intake_entries
      SET image_path=$2,image_url=$3,pending_image_path=NULL,asset_status='ready',
          raw_json=jsonb_set(jsonb_set(jsonb_set(COALESCE(raw_json,'{}'::jsonb),'{image_path}',to_jsonb($2::text),true),'{image_url}',to_jsonb($3::text),true),'{pending_image_path}','null'::jsonb,true),
          updated_at=NOW()
      WHERE id=$1 AND pending_image_path=$2 RETURNING *`, [request.params.entryId, objectKey, publicUrl]);
    if (!result.rowCount) {
      const exists = await pool.query('SELECT 1 FROM monari_intake_entries WHERE id=$1', [request.params.entryId]);
      response.status(exists.rowCount ? 409 : 404).json({ error: exists.rowCount ? 'Upload does not match the pending image for this entry' : 'Entry not found' });
      return;
    }
    response.json({ entry: result.rows[0] });
  } catch (error) { next(error); }
});
