import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../auth.js';
import { pool } from '../db.js';
import { createUploadUrl, publicUrl, safeSegment } from '../r2.js';

const requestSchema = z.object({ entryId: z.string().uuid(), filename: z.string().min(1).max(255), contentType: z.enum(['image/png','image/jpeg','image/webp','image/gif']), assetKind: z.string().min(1).max(40).default('profile') });
export const uploadsRouter = Router();
uploadsRouter.use(requireAdmin);
uploadsRouter.post('/r2-presign', async (request, response, next) => {
  try {
    const input = requestSchema.parse(request.body);
    const result = await pool.query<{ slug: string | null; entry_key: string; batch_key: string }>(`SELECT e.slug,e.entry_key,b.batch_key FROM monari_intake_entries e JOIN monari_intake_batches b ON b.id=e.batch_id WHERE e.id=$1`, [input.entryId]);
    if (!result.rowCount) { response.status(404).json({ error: 'Entry not found' }); return; }
    const entry = result.rows[0]!;
    const objectKey = `intake/${safeSegment(entry.batch_key, 'batch')}/${safeSegment(entry.slug ?? entry.entry_key, input.entryId)}/${safeSegment(input.assetKind, 'profile')}/${Date.now()}-${safeSegment(input.filename, 'upload')}`;
    const uploadUrl = await createUploadUrl(objectKey, input.contentType);
    await pool.query('UPDATE monari_intake_entries SET pending_image_path=$2,updated_at=NOW() WHERE id=$1', [input.entryId, objectKey]);
    response.json({ uploadUrl, method: 'PUT', objectKey, publicUrl: publicUrl(objectKey), expiresIn: 300 });
  } catch (error) { next(error); }
});
