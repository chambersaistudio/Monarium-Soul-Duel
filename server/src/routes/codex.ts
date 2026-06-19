import { Router, type NextFunction, type Request, type Response } from 'express';
import { pool } from '../db.js';
import { requireAdmin } from '../auth.js';

const editableColumns = new Set([
  'codex_no', 'name', 'slug', 'status', 'rarity', 'element_1', 'element_2',
  'taxonomy_primary', 'taxonomy_secondary', 'role', 'stage', 'evolves_from',
  'evolves_to', 'evolution_line_id', 'hp', 'aura', 'attack', 'special_attack',
  'defense', 'special_defense', 'speed', 'ability_name', 'ability_description',
  'ability_effect', 'signature_moves', 'description', 'habitat', 'personality',
  'tags', 'image_url', 'image_path', 'asset_status', 'discovered_by_default',
  'silhouette_enabled', 'public_spoiler_level',
]);

export const codexRouter = Router();
codexRouter.use(requireAdmin);

codexRouter.get('/entries', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT * FROM monari_codex_entries
       ORDER BY codex_no ASC NULLS LAST, lower(name), created_at`,
    );
    response.json({ entries: result.rows });
  } catch (error) { next(error); }
});

codexRouter.get('/entries/:id', async (request, response, next) => {
  try {
    const result = await pool.query('SELECT * FROM monari_codex_entries WHERE id=$1', [request.params.id]);
    if (!result.rowCount) { response.status(404).json({ error: 'Codex entry not found' }); return; }
    response.json({ entry: result.rows[0] });
  } catch (error) { next(error); }
});

codexRouter.post('/promote-intake/:entryId', async (request, response, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const intakeResult = await client.query(
      `SELECT * FROM monari_intake_entries WHERE id=$1 FOR UPDATE`,
      [request.params.entryId],
    );
    if (!intakeResult.rowCount) { response.status(404).json({ error: 'Intake entry not found' }); await client.query('ROLLBACK'); return; }
    const entry = intakeResult.rows[0] as Record<string, unknown>;
    const allowUnnumbered = request.body?.allow_unnumbered === true;
    const missing = [
      ['approved_name', entry.approved_name],
      ['rarity', entry.rarity],
      ['element_1', entry.element_1],
      ['taxonomy_primary', entry.taxonomy_primary],
      ['profile image', entry.image_url || entry.image_path],
      ['asset_status', entry.asset_status],
    ].filter(([, value]) => !value).map(([field]) => field);
    if (!entry.codex_no && !allowUnnumbered) missing.push('codex_no');
    if (missing.length) {
      response.status(400).json({ error: 'Required Codex fields are missing', missing });
      await client.query('ROLLBACK');
      return;
    }
    const slug = slugify(String(entry.slug || entry.approved_name));
    const values = [
      entry.id, entry.codex_no, entry.approved_name, slug, 'approved', entry.rarity,
      entry.element_1, entry.element_2, entry.taxonomy_primary, entry.taxonomy_secondary,
      entry.role, entry.stage, entry.evolves_from, entry.evolves_to, entry.evolution_line_id,
      entry.hp, entry.aura, entry.attack, entry.special_attack, entry.defense,
      entry.special_defense, entry.speed, entry.ability_name, entry.ability_description,
      entry.ability_effect, entry.suggested_signature_moves, entry.description, entry.habitat,
      entry.personality, entry.tags, entry.image_url, entry.image_path, entry.asset_status,
      entry.raw_json,
    ];
    const result = await client.query(
      `INSERT INTO monari_codex_entries (
        intake_entry_id,codex_no,name,slug,status,rarity,element_1,element_2,
        taxonomy_primary,taxonomy_secondary,role,stage,evolves_from,evolves_to,
        evolution_line_id,hp,aura,attack,special_attack,defense,special_defense,
        speed,ability_name,ability_description,ability_effect,signature_moves,
        description,habitat,personality,tags,image_url,image_path,asset_status,raw_json
      ) VALUES (${values.map((_, index) => `$${index + 1}`).join(',')})
      ON CONFLICT (intake_entry_id) DO UPDATE SET
        codex_no=EXCLUDED.codex_no,name=EXCLUDED.name,slug=EXCLUDED.slug,
        status='approved',rarity=EXCLUDED.rarity,element_1=EXCLUDED.element_1,
        element_2=EXCLUDED.element_2,taxonomy_primary=EXCLUDED.taxonomy_primary,
        taxonomy_secondary=EXCLUDED.taxonomy_secondary,role=EXCLUDED.role,
        stage=EXCLUDED.stage,evolves_from=EXCLUDED.evolves_from,evolves_to=EXCLUDED.evolves_to,
        evolution_line_id=EXCLUDED.evolution_line_id,hp=EXCLUDED.hp,aura=EXCLUDED.aura,
        attack=EXCLUDED.attack,special_attack=EXCLUDED.special_attack,defense=EXCLUDED.defense,
        special_defense=EXCLUDED.special_defense,speed=EXCLUDED.speed,
        ability_name=EXCLUDED.ability_name,ability_description=EXCLUDED.ability_description,
        ability_effect=EXCLUDED.ability_effect,signature_moves=EXCLUDED.signature_moves,
        description=EXCLUDED.description,habitat=EXCLUDED.habitat,
        personality=EXCLUDED.personality,tags=EXCLUDED.tags,image_url=EXCLUDED.image_url,
        image_path=EXCLUDED.image_path,asset_status=EXCLUDED.asset_status,
        raw_json=EXCLUDED.raw_json,updated_at=NOW()
      RETURNING *`,
      values,
    );
    await client.query(
      `UPDATE monari_intake_entries
       SET status='approved',slug=$2,promoted_to_codex_at=NOW(),updated_at=NOW()
       WHERE id=$1`,
      [entry.id, slug],
    );
    await client.query('COMMIT');
    response.json({ entry: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

async function updateEntry(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
    const patch = Object.fromEntries(Object.entries(body).filter(([key]) => editableColumns.has(key)).map(([key, value]) => [key, value === '' ? null : value]));
    if (typeof patch.name === 'string' && !patch.slug) patch.slug = slugify(patch.name);
    const columns = Object.keys(patch);
    if (!columns.length) { response.status(400).json({ error: 'No editable fields supplied' }); return; }
    const values = Object.values(patch);
    const result = await pool.query(
      `UPDATE monari_codex_entries SET ${columns.map((column, index) => `${column}=$${index + 2}`).join(',')},updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [request.params.id, ...values],
    );
    if (!result.rowCount) { response.status(404).json({ error: 'Codex entry not found' }); return; }
    response.json({ entry: result.rows[0] });
  } catch (error) { next(error); }
}

codexRouter.patch('/entries/:id', updateEntry);
codexRouter.post('/entries/:id/send-back', async (request, response, next) => setStatus(request, response, next, 'needs_review', true));
codexRouter.post('/entries/:id/hide', async (request, response, next) => setStatus(request, response, next, 'hidden', false));
codexRouter.post('/entries/:id/restore', async (request, response, next) => setStatus(request, response, next, 'approved', false));
codexRouter.post('/entries/:id/remove', async (request, response, next) => setStatus(request, response, next, 'draft', false));

async function setStatus(request: Request, response: Response, next: NextFunction, status: string, sendBack: boolean): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE monari_codex_entries SET status=$2,updated_at=NOW() WHERE id=$1 RETURNING *',
      [request.params.id, status],
    );
    if (!result.rowCount) { response.status(404).json({ error: 'Codex entry not found' }); await client.query('ROLLBACK'); return; }
    if (sendBack && result.rows[0].intake_entry_id) {
      await client.query(
        `UPDATE monari_intake_entries SET status='needs_review',updated_at=NOW() WHERE id=$1`,
        [result.rows[0].intake_entry_id],
      );
    }
    await client.query('COMMIT');
    response.json({ entry: result.rows[0] });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
}

function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}
