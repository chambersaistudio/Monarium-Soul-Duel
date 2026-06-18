import type { PoolClient } from 'pg';

const officialElements = new Set(['Neutral','Fire','Water','Flora','Wind','Thunder','Stone','Steel','Light','Dark','Aether','Ice']);
const editableColumns = new Set([
  'status','image_path','image_url','pending_image_path','approved_name','slug','dex_no','stage','evolves_from','evolves_to','evolution_line_id',
  'rarity','element_1','element_2','taxonomy_primary','taxonomy_secondary','role','hp','aura','attack','special_attack','defense','special_defense','speed',
  'ability_name','ability_description','ability_effect','ability_effect_tags','status_condition_suggestions','suggested_signature_moves','suggested_learnable_moves',
  'description','habitat','personality','tags','confidence','review_notes','asset_status',
]);

function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function number(value: unknown): number | null { const parsed = typeof value === 'number' ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
function append(value: string | null, addition: string): string { return [value, addition].filter(Boolean).join(' '); }
function addTag(value: string | null, tag: string): string { const tags = (value ?? '').split(',').map(item => item.trim()).filter(Boolean); if (!tags.some(item => item.toLowerCase() === tag.toLowerCase())) tags.push(tag); return tags.join(', '); }
function normalizeElement(value: unknown, state: { tags: string | null; notes: string | null }): string | null {
  const original = text(value); if (!original || original === 'None') return null;
  if (original === 'Shadow') { state.tags = addTag(state.tags, 'shadow'); state.notes = append(state.notes, 'Shadow element normalized to Dark.'); return 'Dark'; }
  if (original === 'Void' || original === 'Spirit') { state.tags = addTag(state.tags, original.toLowerCase()); state.notes = append(state.notes, `${original} is not an official element and requires review.`); return null; }
  if (original === 'Gale') return 'Wind';
  if (original === 'Crystal') return 'Aether';
  return officialElements.has(original) ? original : null;
}

export function normalizeEntry(source: Record<string, unknown>, index: number): Record<string, unknown> {
  const state = { tags: text(source.tags), notes: text(source.review_notes) };
  const rarity = text(source.rarity) === 'Ancient' ? 'Ultra Rare' : text(source.rarity);
  if (text(source.rarity) === 'Ancient') state.notes = append(state.notes, 'Ancient rarity normalized to Ultra Rare.');
  const element1 = normalizeElement(source.element_1, state) ?? 'Neutral';
  const element2 = normalizeElement(source.element_2, state);
  const entryKey = text(source.entry_key) ?? text(source.id) ?? text(source.intake_id) ?? `entry_${String(index + 1).padStart(3, '0')}`;
  return {
    entry_key: entryKey, status: text(source.status) ?? 'incoming', source_filename: text(source.source_filename), parent_sheet_filename: text(source.parent_sheet_filename),
    image_path: text(source.image_path) ?? text(source.source_path), image_url: text(source.image_url), pending_image_path: text(source.pending_image_path), approved_name: text(source.approved_name),
    slug: text(source.slug), dex_no: number(source.dex_no), stage: number(source.stage) ?? number(source.stage_number), evolves_from: text(source.evolves_from), evolves_to: text(source.evolves_to),
    evolution_line_id: text(source.evolution_line_id), rarity, element_1: element1, element_2: element2, taxonomy_primary: text(source.taxonomy_primary), taxonomy_secondary: text(source.taxonomy_secondary),
    role: text(source.role), hp: number(source.hp) ?? number(source.health), aura: number(source.aura), attack: number(source.attack), special_attack: number(source.special_attack), defense: number(source.defense),
    special_defense: number(source.special_defense), speed: number(source.speed), ability_name: text(source.ability_name) ?? text(source.ability), ability_description: text(source.ability_description),
    ability_effect: text(source.ability_effect), ability_effect_tags: text(source.ability_effect_tags) ?? text(source.effect_tags), status_condition_suggestions: text(source.status_condition_suggestions),
    suggested_signature_moves: text(source.suggested_signature_moves) ?? text(source.signature_moves), suggested_learnable_moves: text(source.suggested_learnable_moves), description: text(source.description),
    habitat: text(source.habitat), personality: text(source.personality), tags: state.tags, confidence: number(source.confidence) ?? number(source.confidence_score), review_notes: state.notes,
    asset_status: text(source.asset_status), raw_json: source,
  };
}

export function editablePatch(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return Object.fromEntries(Object.entries(body).filter(([key]) => editableColumns.has(key)).map(([key, value]) => [key, value === '' ? null : value]));
}

export async function importBatch(client: PoolClient, payload: Record<string, unknown>): Promise<{ batchKey: string; count: number }> {
  const entries = Array.isArray(payload.entries) ? payload.entries.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item)) : [];
  if (!entries.length) throw new Error('Batch JSON must contain a non-empty entries array.');
  const batchKey = text(payload.batch_key) ?? text(payload.batch_id) ?? text(payload.id) ?? 'batch_001';
  const name = text(payload.name) ?? batchKey;
  const expected = number(payload.expected_entry_count) ?? number(payload.row_count) ?? entries.length;
  const result = await client.query<{ id: string }>(`INSERT INTO monari_intake_batches (batch_key,name,status,source_type,source_label,expected_entry_count,actual_entry_count,imported_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,NOW()),NOW()) ON CONFLICT (batch_key) DO UPDATE SET name=EXCLUDED.name,status=EXCLUDED.status,source_type=EXCLUDED.source_type,
    source_label=EXCLUDED.source_label,expected_entry_count=EXCLUDED.expected_entry_count,actual_entry_count=EXCLUDED.actual_entry_count,imported_at=EXCLUDED.imported_at,updated_at=NOW() RETURNING id`,
    [batchKey,name,text(payload.status) ?? 'in_review',text(payload.source_type),text(payload.source_label) ?? text(payload.source) ?? text(payload.source_filename),expected,entries.length,text(payload.imported_at)]);
  const batchId = result.rows[0]!.id;
  for (const [index, source] of entries.entries()) {
    const entry = normalizeEntry(source, index); const columns = Object.keys(entry); const values = Object.values(entry);
    const updates = columns.filter(column => column !== 'entry_key').map(column => `${column}=EXCLUDED.${column}`).join(',');
    await client.query(`INSERT INTO monari_intake_entries (batch_id,${columns.join(',')}) VALUES ($1,${columns.map((_, i) => `$${i + 2}`).join(',')})
      ON CONFLICT (batch_id,entry_key) DO UPDATE SET ${updates},updated_at=NOW()`, [batchId, ...values]);
  }
  return { batchKey, count: entries.length };
}
