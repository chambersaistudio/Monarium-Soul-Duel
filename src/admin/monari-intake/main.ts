import './styles.css';
import {
  MONARI_ASSET_STATUSES, MONARI_ELEMENTS, MONARI_RARITIES, MONARI_STATUSES, MONARI_TAXONOMIES,
  type IntakeBatch, type MonariEntry, type MonariStatus,
} from './types';

declare global {
  interface ImportMeta {
    readonly env: {
      readonly DEV: boolean;
      readonly VITE_ENABLE_ADMIN?: string;
      readonly VITE_MONARIUM_ADMIN_API_URL?: string;
    };
  }
}

const DATA_URL = '/data/monari-intake/batches/batch_001.json';
const STORAGE_KEY = 'monarium:admin:monari-intake:batch_001';
const ADMIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true';
const API_URL = import.meta.env.VITE_MONARIUM_ADMIN_API_URL?.replace(/\/$/, '') ?? '';
const BACKEND_MODE = Boolean(API_URL);
const ADMIN_KEY_STORAGE = 'monarium:admin:session-key';
const stats = [
  ['hp', 'Health'], ['aura', 'Aura'], ['attack', 'Attack'], ['special_attack', 'Special Attack'],
  ['defense', 'Defense'], ['special_defense', 'Special Defense'], ['speed', 'Speed'],
] as const;

let batch: IntakeBatch;
let selectedId = '';
let query = '';
let statusFilter = '';
let rarityFilter = '';
let taxonomyFilter = '';
let elementFilter = '';
let imageMissing = false;
let dirty = false;
let sourceSignature = '';
let entryListScrollTop = 0;

const app = document.createElement('main');
app.id = 'monari-admin';
document.body.replaceChildren(app);

if (!ADMIN_ENABLED) {
  app.innerHTML = `<section class="disabled"><span>MONARIUM PRIVATE TOOLS</span><h1>Admin disabled</h1><p>Enable <code>VITE_ENABLE_ADMIN=true</code> to use the intake review panel.</p></section>`;
} else {
  void start();
}

async function start(): Promise<void> {
  app.innerHTML = `<section class="loading"><div class="spinner"></div><p>Loading Batch 001…</p></section>`;
  try {
    const source = BACKEND_MODE ? await loadBackendBatch() : await loadLocalBatch();
    sourceSignature = getBatchSignature(source);
    batch = BACKEND_MODE ? source : getSavedBatch(localStorage.getItem(STORAGE_KEY), source);
    selectedId = batch.entries[0]?.id ?? '';
    render();
  } catch (error) {
    app.innerHTML = `<section class="disabled"><span>DATA LOAD ERROR</span><h1>Batch 001 unavailable</h1><p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p><code>${DATA_URL}</code></section>`;
  }
}

async function loadLocalBatch(): Promise<IntakeBatch> {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Batch request failed (${response.status})`);
  return normalizeBatch(await response.json());
}

async function loadBackendBatch(): Promise<IntakeBatch> {
  const key = getAdminKey('Enter the Monarium admin key to load backend intake data.');
  if (!key) throw new Error('An admin key is required in backend mode.');
  const list = await apiRequest<{ batches: Array<{ batch_key: string }> }>('/api/intake/batches', {}, key);
  const batchKey = list.batches[0]?.batch_key;
  if (!batchKey) throw new Error('No intake batches are available in the backend.');
  return normalizeBatch(await apiRequest(`/api/intake/batches/${encodeURIComponent(batchKey)}`, {}, key));
}

function render(options: { preserveListScroll?: boolean } = {}): void {
  const previousScrollTop = options.preserveListScroll
    ? document.querySelector<HTMLElement>('.entry-list')?.scrollTop ?? entryListScrollTop
    : 0;
  const selected = getSelected();
  app.innerHTML = `
    <header class="admin-header">
      <div><p class="eyebrow">MONARIUM STUDIO · PRIVATE DEV TOOL</p><h1>Intake Review</h1></div>
      <div class="batch-summary"><span class="live-dot"></span><div><b>${escapeHtml(batch.name)}</b><small>${escapeHtml(batch.status)} · ${batch.entries.length} entries</small></div></div>
      <div class="header-actions"><span class="mode-indicator ${BACKEND_MODE ? 'backend' : 'local'}">${BACKEND_MODE ? 'Railway backend' : 'Local fallback'}</span><span id="save-state">${dirty ? 'Unsaved changes' : BACKEND_MODE ? 'Synced' : 'Saved locally'}</span><button class="button secondary" data-action="export">Export Updated JSON</button></div>
    </header>
      <div class="admin-layout">
      <aside class="library-panel">
        <label class="batch-picker"><span>Active batch</span><select><option>${escapeHtml(batch.name)}</option></select><small>Imported ${formatDate(batch.imported_at)}</small></label>
        <label class="search"><span>⌕</span><input id="search" type="search" value="${escapeAttr(query)}" placeholder="Search name, tag, ID…" /></label>
        <div class="filters">
          ${filterSelect('status-filter', 'All statuses', [...MONARI_STATUSES], statusFilter)}
          ${filterSelect('rarity-filter', 'All rarities', [...MONARI_RARITIES], rarityFilter)}
          ${filterSelect('taxonomy-filter', 'All taxonomies', [...MONARI_TAXONOMIES], taxonomyFilter)}
          ${filterSelect('element-filter', 'All elements', [...MONARI_ELEMENTS], elementFilter)}
        </div>
        <div class="result-count"><span>${filteredEntries().length} Monari</span><button data-action="clear-filters">Clear filters</button></div>
        <nav class="entry-list" aria-label="Monari entries">${renderList()}</nav>
        <section class="source-note"><b>${BACKEND_MODE ? 'Railway API source' : 'Local JSON source'}</b><code>${BACKEND_MODE ? escapeHtml(API_URL) : 'data/monari-intake/batches/batch_001.json'}</code><p>${BACKEND_MODE ? 'Edits save to PostgreSQL. Export remains available as a backup.' : 'Backend is disabled; browser storage and JSON export remain active.'}</p></section>
      </aside>
      <section class="review-pane">
        ${renderPersistenceNotice()}
        ${selected ? renderEditor(selected) : renderEmpty()}
      </section>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>`;
  bindEvents();
  const list = document.querySelector<HTMLElement>('.entry-list');
  if (list) {
    list.scrollTop = previousScrollTop;
    entryListScrollTop = list.scrollTop;
  }
}

function renderList(): string {
  const entries = filteredEntries();
  if (!entries.length) return `<div class="empty-list">No Monari match these filters.</div>`;
  return entries.map(entry => `
    <button class="entry-item ${entry.id === selectedId ? 'selected' : ''}" data-select="${escapeAttr(entry.id)}">
      <span class="thumb"><img src="${escapeAttr(imageUrl(entry.image_path))}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden title="${escapeAttr(imageUrl(entry.image_path))}">✦</span></span>
      <span class="entry-copy"><b>${escapeHtml(entry.approved_name || 'Unnamed Monari')}</b><small>${escapeHtml(entry.id)} · Stage ${entry.stage_number}</small><span class="badges"><i class="badge status-${entry.status}">${label(entry.status)}</i><i class="badge rarity">${escapeHtml(entry.rarity || 'Unrated')}</i></span></span>
      <span class="chevron">›</span>
    </button>`).join('');
}

function renderEditor(entry: MonariEntry): string {
  const total = stats.reduce((sum, [key]) => sum + Number(entry[key] || 0), 0);
  const entries = filteredEntries();
  const selectedIndex = entries.findIndex(candidate => candidate.id === entry.id);
  return `
    <div class="review-toolbar"><div class="review-title"><p class="eyebrow">ENTRY ${escapeHtml(entry.id)}</p><h2>${escapeHtml(entry.approved_name || 'Unnamed Monari')}</h2></div><div class="entry-navigation"><button class="icon-button nav-button" data-action="previous" ${selectedIndex <= 0 ? 'disabled' : ''} aria-label="Previous entry">← <span>Previous</span></button><button class="icon-button nav-button" data-action="next" ${selectedIndex < 0 || selectedIndex >= entries.length - 1 ? 'disabled' : ''} aria-label="Next entry"><span>Next</span> →</button></div><div class="toolbar-actions"><button class="icon-button" data-action="speak" title="Pronounce name" aria-label="Pronounce name">◖))</button><select data-field="status" aria-label="Status">${options(MONARI_STATUSES, entry.status)}</select><button class="button primary" data-action="save">Save</button></div></div>
    <div class="review-grid">
      <article class="visual-card">
        <div class="image-stage ${imageMissing ? 'missing' : ''}">
          <div class="image-grid"></div><img id="preview-image" src="${escapeAttr(imageUrl(entry.image_path))}" alt="${escapeAttr(entry.approved_name)} intake preview"><div class="placeholder"><span>✦</span><b>MONARIUM</b><small>Image preview unavailable</small></div>
          <span class="stage-chip">STAGE ${entry.stage_number}</span><span id="image-warning" class="image-warning">⚠ Image missing</span>
        </div>
        <div class="image-debug"><span>Current image URL</span><code>${escapeHtml(imageUrl(entry.image_path) || '(empty path)')}</code><div class="image-actions"><a class="button secondary" href="${escapeAttr(imageUrl(entry.image_path))}" target="_blank" rel="noreferrer">Open Image</a><button class="button secondary" data-action="change-image">${BACKEND_MODE ? 'Upload New Image' : 'Change Image Path'}</button></div><input id="image-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><label class="image-path-field" hidden><span>Browser-visible image path</span><input id="image-path-input" value="${escapeAttr(entry.image_path)}" placeholder="/assets/monari/_incoming/batch_001/..."><small>Local review only. Export JSON and add the image file to repo/cloud storage to make this permanent online.</small></label><p class="image-failure">Failed URL: <b>${escapeHtml(imageUrl(entry.image_path) || '(empty path)')}</b></p></div>
        <div class="visual-meta"><span><small>ELEMENT</small><b>${escapeHtml(entry.element_1 || '—')}${entry.element_2 ? ` / ${escapeHtml(entry.element_2)}` : ''}</b></span><span><small>RARITY</small><b>${escapeHtml(entry.rarity || '—')}</b></span><span><small>ROLE</small><b>${escapeHtml(entry.role || '—')}</b></span></div>
        <div class="future-tools"><div><p class="eyebrow">IMAGE WORKSPACE</p><b>${BACKEND_MODE ? 'Cloudflare R2 upload' : 'Path-based replacement'}</b><small>${BACKEND_MODE ? 'Images upload directly with a temporary signed URL; storage secrets remain on Railway.' : 'Local previews are not permanent online. Path edits are included in exported JSON.'}</small></div><button class="button secondary" data-action="change-image">Replace Profile Image</button></div>
        <div class="ai-panel"><span>✦</span><div><p class="eyebrow">AI HELPER</p><b>AI Helper Coming Soon</b><small>Name, lore, taxonomy, and stat suggestions.</small></div><button class="button secondary" data-action="copy-prompt">Copy AI Rename Prompt</button></div>
      </article>
      <article class="editor-card">
        ${section('Identity', `<div class="field-grid identity-grid">${input('approved_name','Approved name',entry.approved_name)}${input('slug','Slug',entry.slug)}${selectField('status','Review status',MONARI_STATUSES,entry.status)}${selectField('rarity','Rarity',MONARI_RARITIES,entry.rarity)}</div>`)}
        ${section('Profile', `<div class="read-grid">${readField('Source filename',entry.source_filename)}${readField('Parent sheet',entry.parent_sheet_filename)}${readField('Evolution line ID',entry.evolution_line_id)}${readField('Stage',String(entry.stage_number))}${readField('Evolves from',entry.evolves_from || '—')}${readField('Evolves to',entry.evolves_to || '—')}</div><div class="field-grid three">${selectField('asset_status','Asset status',MONARI_ASSET_STATUSES,entry.asset_status)}${input('habitat','Habitat',entry.habitat)}${input('personality','Personality',entry.personality)}</div>`)}
        ${section('Classification', `<div class="field-grid three">${selectField('element_1','Element 1',MONARI_ELEMENTS,entry.element_1)}${selectField('element_2','Element 2',['', ...MONARI_ELEMENTS],entry.element_2)}${input('role','Role',entry.role)}${selectField('taxonomy_primary','Primary taxonomy',MONARI_TAXONOMIES,entry.taxonomy_primary)}${selectField('taxonomy_secondary','Secondary taxonomy',['', ...MONARI_TAXONOMIES],entry.taxonomy_secondary)}</div>`)}
        ${section('Stats', `<div class="stat-head"><span>7 Monarium attributes</span><b>Total <strong id="stat-total">${total}</strong></b></div><div class="stats-grid">${stats.map(([key,name]) => statInput(key,name,entry[key])).join('')}</div>`)}
        ${section('Ability & lore', `<div class="field-grid">${input('ability_name','Ability name',entry.ability_name)}${input('signature_moves','Legacy signature moves',entry.signature_moves)}</div>${textarea('ability_description','Ability flavor description',entry.ability_description)}${textarea('ability_effect','In-game effect',entry.ability_effect)}<div class="field-grid">${textarea('ability_effect_tags','Ability effect tags (comma separated)',entry.ability_effect_tags)}${textarea('status_condition_suggestions','Status condition suggestions',entry.status_condition_suggestions)}</div>${textarea('description','Monari description',entry.description)}<div class="field-grid">${textarea('tags','Tags (comma separated)',entry.tags)}${textarea('review_notes','Review notes',entry.review_notes)}</div><label class="confidence"><span>Confidence score</span><div><input data-field="confidence_score" type="range" min="0" max="1" step="0.01" value="${entry.confidence_score}"><output id="confidence-output">${Math.round(entry.confidence_score * 100)}%</output></div></label>`)}
        <details class="moveset-section"><summary>Learnable Moves / Moveset <span>Coming Soon</span></summary><div class="field-grid">${textarea('suggested_signature_moves','Suggested signature moves',entry.suggested_signature_moves)}${textarea('suggested_learnable_moves','Suggested learnable moves',entry.suggested_learnable_moves)}</div><p>Future recommendations will use element, taxonomy, tags, role, and evolution stage.</p></details>
        <div class="decision-bar"><div><p class="eyebrow">REVIEW DECISION</p><span>Update status, then save your local review.</span></div><div><button class="button approve" data-status="approved">Approve</button><button class="button needs-edit" data-status="needs_review">Needs Edit</button><button class="button reject" data-status="rejected">Reject</button><button class="button primary" data-action="save">Save Changes</button></div></div>
      </article>
    </div>`;
}

function renderPersistenceNotice(): string {
  const sampleWarning = batch.data_status === 'sample'
    ? `<p class="sample-warning"><b>Sample data only:</b> ${batch.entries.length} of approximately ${batch.expected_entry_count ?? 41} expected Batch 001 rows are available. Replace the canonical file with the authoritative spreadsheet conversion before production review.</p>`
    : '';
  return `<aside class="persistence-notice ${BACKEND_MODE ? 'backend' : ''}">
    <div><b>${BACKEND_MODE ? 'Backend-connected review' : 'Browser-only working copy'}</b><p>${BACKEND_MODE ? 'Save writes this entry to Railway PostgreSQL. Export Updated JSON remains a portable backup.' : 'Save keeps edits only in this browser. Export Updated JSON is the safe, permanent copy.'}</p>${sampleWarning}</div>
    <code>${BACKEND_MODE ? 'Storage: PostgreSQL + Cloudflare R2' : 'Replace: data/monari-intake/batches/batch_001.json'}</code>
  </aside>`;
}

function bindEvents(): void {
  const list = document.querySelector<HTMLElement>('.entry-list');
  list?.addEventListener('scroll', () => { entryListScrollTop = list.scrollTop; }, { passive: true });
  document.querySelectorAll<HTMLElement>('[data-select]').forEach(node => node.addEventListener('click', () => selectEntry(node.dataset.select ?? '')));
  bindFilter('search', value => query = value);
  bindFilter('status-filter', value => statusFilter = value);
  bindFilter('rarity-filter', value => rarityFilter = value);
  bindFilter('taxonomy-filter', value => taxonomyFilter = value);
  bindFilter('element-filter', value => elementFilter = value);
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-field]').forEach(control => {
    control.addEventListener('input', () => updateField(control));
    control.addEventListener('change', () => updateField(control));
  });
  document.querySelectorAll<HTMLElement>('[data-action]').forEach(node => node.addEventListener('click', () => handleAction(node.dataset.action ?? '')));
  document.querySelectorAll<HTMLElement>('[data-status]').forEach(node => node.addEventListener('click', () => { updateStatus(node.dataset.status as MonariStatus); }));
  const image = document.querySelector<HTMLImageElement>('#preview-image');
  image?.addEventListener('error', () => { imageMissing = true; image.closest('.image-stage')?.classList.add('missing'); });
  image?.addEventListener('load', () => { imageMissing = false; image.closest('.image-stage')?.classList.remove('missing'); });
  document.querySelector<HTMLInputElement>('#image-path-input')?.addEventListener('input', event => updateImagePath((event.target as HTMLInputElement).value));
  document.querySelector<HTMLInputElement>('#image-file-input')?.addEventListener('change', event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void uploadImage(file);
  });
  const speaker = document.querySelector<HTMLButtonElement>('[data-action="speak"]');
  if (!('speechSynthesis' in window) && speaker) speaker.disabled = true;
  window.onbeforeunload = dirty ? () => 'You have unsaved intake edits.' : null;
}

function updateField(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  const entry = getSelected();
  const field = control.dataset.field as keyof MonariEntry;
  if (!entry || !field) return;
  const numeric = control.type === 'number' || control.type === 'range';
  (entry as unknown as Record<string, string | number>)[field] = numeric ? Number(control.value) : control.value;
  dirty = true;
  if (stats.some(([key]) => key === field)) {
    const value = Math.max(0, Math.min(150, Number(control.value)));
    control.closest('.stat-row')?.querySelector<HTMLElement>('.stat-fill')?.style.setProperty('--stat-value', `${value / 1.5}%`);
    const total = stats.reduce((sum, [key]) => sum + Number(entry[key] || 0), 0);
    const totalNode = document.querySelector('#stat-total'); if (totalNode) totalNode.textContent = String(total);
  }
  if (field === 'confidence_score') { const output = document.querySelector('#confidence-output'); if (output) output.textContent = `${Math.round(Number(control.value) * 100)}%`; }
  if (field === 'approved_name') { const title = document.querySelector('.review-toolbar h2'); if (title) title.textContent = control.value || 'Unnamed Monari'; }
  setSaveState('Unsaved changes');
}

function handleAction(action: string): void {
  if (action === 'save') void saveChanges();
  if (action === 'export') exportJson();
  if (action === 'speak') speakName();
  if (action === 'copy-prompt') void copyPrompt();
  if (action === 'previous') navigateEntry(-1);
  if (action === 'next') navigateEntry(1);
  if (action === 'change-image') {
    if (BACKEND_MODE) document.querySelector<HTMLInputElement>('#image-file-input')?.click();
    else {
      const field = document.querySelector<HTMLElement>('.image-path-field');
      if (field) { field.hidden = false; field.querySelector<HTMLInputElement>('input')?.focus(); }
    }
  }
  if (action === 'clear-filters') { query = ''; statusFilter = ''; rarityFilter = ''; taxonomyFilter = ''; elementFilter = ''; entryListScrollTop = 0; render(); }
}

function selectEntry(id: string): void {
  if (!id || id === selectedId) return;
  selectedId = id;
  imageMissing = false;
  render({ preserveListScroll: true });
}

function navigateEntry(offset: -1 | 1): void {
  const entries = filteredEntries();
  const index = entries.findIndex(entry => entry.id === selectedId);
  const target = entries[index + offset];
  if (target) selectEntry(target.id);
}

function updateImagePath(value: string): void {
  const entry = getSelected();
  if (!entry) return;
  entry.image_path = imageUrl(value);
  imageMissing = false;
  dirty = true;
  const image = document.querySelector<HTMLImageElement>('#preview-image');
  if (image) { image.hidden = false; image.src = entry.image_path; }
  const code = document.querySelector<HTMLElement>('.image-debug code');
  if (code) code.textContent = entry.image_path || '(empty path)';
  const open = document.querySelector<HTMLAnchorElement>('.image-actions a');
  if (open) open.href = entry.image_path;
  setSaveState('Unsaved changes');
}

function updateStatus(status: MonariStatus): void {
  const entry = getSelected(); if (!entry) return;
  entry.status = status; dirty = true; void saveChanges().then(() => { render(); showToast(`Marked ${label(status)}`); });
}

async function saveChanges(): Promise<void> {
  if (!BACKEND_MODE) { saveLocal(); return; }
  const entry = getSelected(); if (!entry) return;
  const key = getAdminKey('Enter the Monarium admin key to save this entry.');
  if (!key) { showToast('Save cancelled: admin key required'); return; }
  setSaveState('Saving…');
  try {
    const payload = toBackendEntry(entry);
    const result = await apiRequest<{ entry: Record<string, unknown> }>(`/api/intake/entries/${encodeURIComponent(entry.id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, key);
    Object.assign(entry, normalizeEntry(result.entry, 0, new Date().toISOString()));
    dirty = false; window.onbeforeunload = null; setSaveState('Synced'); showToast('Entry saved to Railway');
  } catch (error) { setSaveState('Save failed'); showToast(error instanceof Error ? error.message : 'Backend save failed'); }
}

function saveLocal(): void {
  const entry = getSelected();
  if (entry) entry.updated_at = new Date().toISOString();
  batch.updated_at = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ source_signature: sourceSignature, batch })); dirty = false; window.onbeforeunload = null;
  setSaveState('Saved locally'); showToast('Review saved in this browser');
}

function exportJson(): void {
  if (!BACKEND_MODE) saveLocal();
  batch = normalizeBatch(batch);
  const blob = new Blob([`${JSON.stringify(batch, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'batch_001.json'; link.click(); URL.revokeObjectURL(link.href);
  showToast('Permanent batch_001.json copy exported');
}

function speakName(): void {
  const entry = getSelected(); if (!entry || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(entry.approved_name));
}

async function copyPrompt(): Promise<void> {
  const entry = getSelected(); if (!entry) return;
  const prompt = `Suggest 10 original Monarium creature names for this intake entry. Elements: ${entry.element_1}${entry.element_2 ? ` / ${entry.element_2}` : ''}. Taxonomy: ${entry.taxonomy_primary} / ${entry.taxonomy_secondary}. Role: ${entry.role}. Personality: ${entry.personality}. Description: ${entry.description}. Avoid names already implied by: ${entry.approved_name}. Explain pronunciation and naming rationale.`;
  try { await navigator.clipboard.writeText(prompt); showToast('AI rename prompt copied'); } catch { showToast('Clipboard unavailable'); }
}

function filteredEntries(): MonariEntry[] {
  const term = query.trim().toLowerCase();
  return batch.entries.filter(entry => (!term || [entry.approved_name, entry.slug, entry.id, entry.tags].some(value => value.toLowerCase().includes(term))) && (!statusFilter || entry.status === statusFilter) && (!rarityFilter || entry.rarity === rarityFilter) && (!taxonomyFilter || entry.taxonomy_primary === taxonomyFilter) && (!elementFilter || entry.element_1 === elementFilter || entry.element_2 === elementFilter));
}
function normalizeBatch(value: unknown): IntakeBatch {
  const source = value && typeof value === 'object' ? value as Partial<IntakeBatch> : {};
  if (!Array.isArray(source.entries)) throw new Error('Batch JSON must contain an entries array.');
  const now = new Date().toISOString();
  return {
    id: stringValue(source.id, stringValue((source as Record<string, unknown>).batch_key, stringValue((source as Record<string, unknown>).batch_id, 'batch_001'))),
    batch_key: stringValue((source as Record<string, unknown>).batch_key, stringValue((source as Record<string, unknown>).batch_id, 'batch_001')),
    name: stringValue(source.name, 'Batch 001'),
    status: stringValue(source.status, 'in_review'),
    data_status: source.data_status === 'sample' ? 'sample' : 'complete',
    expected_entry_count: numberValue(source.expected_entry_count, source.entries.length),
    imported_at: stringValue(source.imported_at, now),
    updated_at: stringValue(source.updated_at, now),
    source_filename: stringValue(source.source_filename),
    image_root: stringValue(source.image_root, '/assets/monari/_incoming/batch_001/'),
    entries: source.entries.map((entry, index) => normalizeEntry(entry, index, now)),
  };
}
function getSavedBatch(saved: string | null, source: IntakeBatch): IntakeBatch {
  if (!saved) return source;
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (parsed && typeof parsed === 'object' && 'source_signature' in parsed && 'batch' in parsed) {
      const record = parsed as { source_signature?: unknown; batch?: unknown };
      return record.source_signature === sourceSignature ? normalizeBatch(record.batch) : source;
    }
    // Preserve legacy V1 edits only while the canonical file is still the sample fixture.
    return source.data_status === 'sample' ? normalizeBatch(parsed) : source;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return source;
  }
}
function getBatchSignature(value: IntakeBatch): string {
  return JSON.stringify([value.id, value.imported_at, value.source_filename, value.entries.map(entry => entry.id)]);
}
function normalizeEntry(value: unknown, index: number, now: string): MonariEntry {
  const entry = value && typeof value === 'object' ? value as Partial<MonariEntry> & Record<string, unknown> : {};
  const status = MONARI_STATUSES.includes(entry.status as MonariStatus) ? entry.status as MonariStatus : 'incoming';
  const ancientRarity = entry.rarity === 'Ancient';
  const legacyAbility = stringValue(entry.ability);
  const originalElements = [stringValue(entry.element_1), stringValue(entry.element_2)];
  const normalizedElements = originalElements.map(normalizeElement);
  const elementMigrationNotes = originalElements.flatMap((element, index) => {
    if (!element || element === 'None' || element === normalizedElements[index]) return [];
    return [`${element} element normalized to ${normalizedElements[index]}.`];
  });
  const notes = [stringValue(entry.review_notes), ...elementMigrationNotes].filter(Boolean).join(' ');
  const migratedTags = originalElements.includes('Shadow') && !stringValue(entry.tags).toLowerCase().split(',').map(tag => tag.trim()).includes('shadow')
    ? [stringValue(entry.tags), 'shadow'].filter(Boolean).join(', ')
    : stringValue(entry.tags);
  return {
    id: stringValue(entry.id, stringValue(entry.intake_id, `batch001-${String(index + 1).padStart(3, '0')}`)),
    approved_name: stringValue(entry.approved_name, 'Unnamed Monari'),
    slug: stringValue(entry.slug),
    status,
    rarity: ancientRarity ? 'Ultra Rare' : stringValue(entry.rarity),
    element_1: normalizedElements[0] || 'Neutral',
    element_2: originalElements[1] === 'None' ? '' : normalizedElements[1],
    taxonomy_primary: stringValue(entry.taxonomy_primary),
    taxonomy_secondary: stringValue(entry.taxonomy_secondary) === 'None' ? '' : stringValue(entry.taxonomy_secondary),
    role: stringValue(entry.role),
    hp: numberValue(entry.hp, numberValue(entry.health)), aura: numberValue(entry.aura), attack: numberValue(entry.attack),
    special_attack: numberValue(entry.special_attack), defense: numberValue(entry.defense),
    special_defense: numberValue(entry.special_defense), speed: numberValue(entry.speed),
    ability_name: stringValue(entry.ability_name, legacyAbility),
    ability_description: stringValue(entry.ability_description),
    ability_effect: stringValue(entry.ability_effect),
    ability_effect_tags: stringValue(entry.ability_effect_tags, stringValue(entry.effect_tags)),
    status_condition_suggestions: stringValue(entry.status_condition_suggestions),
    signature_moves: stringValue(entry.signature_moves),
    suggested_signature_moves: stringValue(entry.suggested_signature_moves, stringValue(entry.signature_moves)),
    suggested_learnable_moves: stringValue(entry.suggested_learnable_moves),
    description: stringValue(entry.description), habitat: stringValue(entry.habitat),
    personality: stringValue(entry.personality), tags: migratedTags,
    review_notes: ancientRarity && !notes.includes('Ancient rarity migrated to Ultra Rare')
      ? [notes, 'Ancient rarity migrated to Ultra Rare'].filter(Boolean).join(' ')
      : notes,
    asset_status: normalizeAssetStatus(entry.asset_status),
    confidence_score: numberValue(entry.confidence_score, numberValue(entry.confidence)),
    image_path: imageUrl(stringValue(entry.image_url, stringValue(entry.image_path, stringValue(entry.source_path)))),
    source_filename: stringValue(entry.source_filename),
    parent_sheet_filename: stringValue(entry.parent_sheet_filename),
    evolution_line_id: stringValue(entry.evolution_line_id),
    stage_number: numberValue(entry.stage_number, numberValue(entry.stage, 1)),
    evolves_from: stringValue(entry.evolves_from), evolves_to: stringValue(entry.evolves_to),
    updated_at: stringValue(entry.updated_at, now),
  };
}
function normalizeElement(value: string): string {
  if (value === 'Shadow') return 'Dark';
  if (value === 'Gale') return 'Wind';
  if (value === 'Crystal') return 'Aether';
  if (value === 'Void' || value === 'Spirit') return 'Neutral';
  return value;
}
function normalizeAssetStatus(value: unknown): string {
  const status = stringValue(value);
  if (MONARI_ASSET_STATUSES.includes(status as typeof MONARI_ASSET_STATUSES[number])) return status;
  if (status === 'concept_only') return 'temporary_concept';
  return status ? 'needs_cleanup' : 'missing';
}
function imageUrl(value: string): string {
  const trimmed = value.trim().replace(/\\/g, '/');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  let publicPath = trimmed.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/?public\//i, '/');
  if (!publicPath.startsWith('/')) publicPath = `/${publicPath}`;
  return publicPath.split('/').map((part, index) => index === 0 ? '' : encodeURIComponent(decodeURIComponent(part))).join('/');
}
function stringValue(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function numberValue(value: unknown, fallback = 0): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function getAdminKey(promptText: string): string {
  const saved = sessionStorage.getItem(ADMIN_KEY_STORAGE);
  if (saved) return saved;
  const entered = window.prompt(promptText)?.trim() ?? '';
  if (entered) sessionStorage.setItem(ADMIN_KEY_STORAGE, entered);
  return entered;
}
async function apiRequest<T>(path: string, init: RequestInit = {}, key = getAdminKey('Enter the Monarium admin key.')): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': key, ...init.headers },
  });
  if (response.status === 401) sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
    throw new Error(payload.message ?? payload.error ?? `Backend request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
function toBackendEntry(entry: MonariEntry): Record<string, unknown> {
  const { id: _id, stage_number, confidence_score, signature_moves: _signatureMoves, updated_at: _updatedAt, ...fields } = entry;
  return { ...fields, stage: stage_number, confidence: confidence_score };
}
async function uploadImage(file: File): Promise<void> {
  const entry = getSelected(); if (!entry) return;
  const key = getAdminKey('Enter the Monarium admin key to upload this image.');
  if (!key) { showToast('Upload cancelled: admin key required'); return; }
  setSaveState('Uploading image…');
  try {
    const signed = await apiRequest<{ uploadUrl: string; method: string; objectKey: string; publicUrl: string }>('/api/uploads/r2-presign', {
      method: 'POST', body: JSON.stringify({ entryId: entry.id, filename: file.name, contentType: file.type, assetKind: 'profile' }),
    }, key);
    const upload = await fetch(signed.uploadUrl, { method: signed.method, headers: { 'Content-Type': file.type }, body: file });
    if (!upload.ok) throw new Error(`R2 upload failed (${upload.status})`);
    await apiRequest(`/api/intake/entries/${encodeURIComponent(entry.id)}/asset`, {
      method: 'POST', body: JSON.stringify({ objectKey: signed.objectKey, publicUrl: signed.publicUrl }),
    }, key);
    entry.image_path = signed.publicUrl; entry.asset_status = 'ready'; dirty = false;
    render({ preserveListScroll: true }); showToast('Profile image uploaded to R2');
  } catch (error) { setSaveState('Upload failed'); showToast(error instanceof Error ? error.message : 'Image upload failed'); }
}
function getSelected(): MonariEntry | undefined { return batch.entries.find(entry => entry.id === selectedId); }
function bindFilter(id: string, assign: (value: string) => void): void { document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.addEventListener('input', event => { assign((event.target as HTMLInputElement).value); entryListScrollTop = 0; render(); }); }
function setSaveState(text: string): void { const node = document.querySelector('#save-state'); if (node) node.textContent = text; }
function showToast(text: string): void { const toast = document.querySelector<HTMLElement>('#toast'); if (!toast) return; toast.textContent = text; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2200); }
function renderEmpty(): string { return `<div class="empty-review"><span>✦</span><h2>Select a Monari</h2><p>Choose an intake row to begin review.</p></div>`; }
function section(title: string, content: string): string { return `<section class="form-section"><h3>${title}</h3>${content}</section>`; }
function input(field: keyof MonariEntry, title: string, value: string): string { return `<label><span>${title}</span><input data-field="${field}" value="${escapeAttr(value)}"></label>`; }
function textarea(field: keyof MonariEntry, title: string, value: string): string { return `<label><span>${title}</span><textarea data-field="${field}">${escapeHtml(value)}</textarea></label>`; }
function selectField(field: keyof MonariEntry, title: string, values: readonly string[], value: string): string { return `<label><span>${title}</span><select data-field="${field}">${options(values,value)}</select></label>`; }
function statInput(field: typeof stats[number][0], title: string, value: number): string { const pct = Math.max(0, Math.min(100, value / 1.5)); return `<label class="stat-row"><span>${title}</span><div class="stat-control"><div class="stat-track"><i class="stat-fill" style="--stat-value:${pct}%"></i></div><input data-field="${field}" type="number" min="0" max="150" value="${value}"></div></label>`; }
function readField(title: string, value: string): string { return `<div><span>${title}</span><b title="${escapeAttr(value)}">${escapeHtml(value)}</b></div>`; }
function filterSelect(id: string, placeholder: string, values: string[], selected: string): string { return `<select id="${id}" aria-label="${placeholder}"><option value="">${placeholder}</option>${options(values, selected)}</select>`; }
function options(values: readonly string[], selected: string): string {
  const available = values.includes(selected) || !selected ? values : [selected, ...values];
  return available.map(value => `<option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${value ? escapeHtml(label(value)) : 'None'}</option>`).join('');
}
function label(value: string): string { return value.replace(/_/g,' ').replace(/\b\w/g, (char: string) => char.toUpperCase()); }
function formatDate(value: string): string { return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char] ?? char)); }
function escapeAttr(value: string): string { return escapeHtml(value); }
