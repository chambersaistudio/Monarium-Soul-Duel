import './styles.css';
import {
  MONARI_ASSET_STATUSES, MONARI_ELEMENTS, MONARI_RARITIES, MONARI_STATUSES, MONARI_TAXONOMIES,
  type CodexEntry, type IntakeBatch, type MonariEntry, type MonariStatus,
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
const RAW_API_URL = import.meta.env.VITE_MONARIUM_ADMIN_API_URL?.trim() ?? '';
const API_URL = normalizeApiUrl(RAW_API_URL);
const BACKEND_MODE = Boolean(API_URL);
const ADMIN_KEY_STORAGE = 'monarium:admin:session-key';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
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
let saveError = '';
let sourceSignature = '';
let entryListScrollTop = 0;
let backendHealthPassed = false;
let view: 'intake' | 'codex' = 'intake';
let batches: Array<{ batch_key: string; name: string }> = [];
let codexEntries: CodexEntry[] = [];
let codexQuery = '';
let codexStatus = '';
let importPreview: { payload: Record<string, unknown>; warnings: string[]; errors: string[]; filename: string } | null = null;
let codexPreviewId = '';

class BackendRequestError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly url: string,
    readonly status?: number,
    readonly responseBody?: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'BackendRequestError';
  }
}

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    const noBatches = BACKEND_MODE && message.startsWith('No backend batches found');
    const requestError = error instanceof BackendRequestError ? error : undefined;
    const healthFailure = requestError?.url === `${API_URL}/health`;
    app.innerHTML = `<section class="disabled backend-error"><span>${BACKEND_MODE ? 'BACKEND MODE' : 'DATA LOAD ERROR'}</span><h1>${noBatches ? 'No backend batches found' : healthFailure ? 'Backend health check failed' : BACKEND_MODE ? 'Backend connection failed' : 'Batch 001 unavailable'}</h1><p>${escapeHtml(noBatches ? 'Railway is healthy, but no intake batches are available. Run the database migration and Batch 001 import.' : message)}</p>${BACKEND_MODE ? renderBackendDiagnostics(requestError) : `<code>${DATA_URL}</code>`}${BACKEND_MODE ? '<button class="button secondary" data-retry>Retry connection</button>' : ''}</section>`;
    document.querySelector('[data-retry]')?.addEventListener('click', () => void start());
  }
}

async function loadLocalBatch(): Promise<IntakeBatch> {
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`Batch request failed (${response.status})`);
  return normalizeBatch(await response.json());
}

async function loadBackendBatch(): Promise<IntakeBatch> {
  backendHealthPassed = false;
  await checkBackendHealth();
  backendHealthPassed = true;
  const key = getAdminKey('Enter the Monarium admin key to load backend intake data.');
  if (!key) throw new Error('An admin key is required in backend mode.');
  const list = await apiRequest<{ batches: Array<{ batch_key: string; name: string }> }>('/api/intake/batches', {}, key);
  batches = list.batches;
  const batchKey = list.batches[0]?.batch_key;
  if (!batchKey) throw new Error('No backend batches found. Run migration/import first.');
  return normalizeBatch(await apiRequest(`/api/intake/batches/${encodeURIComponent(batchKey)}`, {}, key));
}

function render(options: { preserveListScroll?: boolean } = {}): void {
  const previousScrollTop = options.preserveListScroll
    ? document.querySelector<HTMLElement>('.entry-list')?.scrollTop ?? entryListScrollTop
    : 0;
  const selected = getSelected();
  app.innerHTML = `
    <header class="admin-header">
      <div><p class="eyebrow">MONARIUM STUDIO · PRIVATE DEV TOOL</p><h1>${view === 'intake' ? 'Review Queue' : 'Live Codex'}</h1></div>
      <nav class="admin-tabs"><button class="${view === 'intake' ? 'active' : ''}" data-view="intake">Review Queue</button><button class="${view === 'codex' ? 'active' : ''}" data-view="codex">Live Codex</button></nav>
      <div class="header-actions"><span class="mode-indicator ${BACKEND_MODE ? 'backend' : 'local'}">${BACKEND_MODE ? 'Backend Mode' : 'Local JSON Mode'}</span><span class="connection-state">${BACKEND_MODE ? '<i></i> Connected to Railway' : 'Backend disabled'}</span><span id="save-state">${dirty ? 'Unsaved changes' : BACKEND_MODE ? 'Changes persist after refresh' : 'Saved locally'}</span></div>
    </header>
    ${view === 'intake' ? `<div class="admin-layout">
      <aside class="library-panel">
        <div class="batch-tools"><label class="batch-picker"><span>Active batch</span><select id="batch-select">${(batches.length ? batches : [{ batch_key: batch.batch_key ?? batch.id, name: batch.name }]).map(item => `<option value="${escapeAttr(item.batch_key)}" ${item.batch_key === batch.batch_key ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select><small>Imported ${formatDate(batch.imported_at)}</small></label>${BACKEND_MODE ? '<button class="button secondary" data-action="import-batch">Import Batch</button><input id="batch-file-input" type="file" accept="application/json,.json" hidden>' : ''}</div>
        <label class="search"><span>⌕</span><input id="search" type="search" value="${escapeAttr(query)}" placeholder="Search name, tag, ID…" /></label>
        <div class="filters">
          ${filterSelect('status-filter', 'All statuses', [...MONARI_STATUSES], statusFilter)}
          ${filterSelect('rarity-filter', 'All rarities', [...MONARI_RARITIES], rarityFilter)}
          ${filterSelect('taxonomy-filter', 'All taxonomies', [...MONARI_TAXONOMIES], taxonomyFilter)}
          ${filterSelect('element-filter', 'All elements', [...MONARI_ELEMENTS], elementFilter)}
        </div>
        <div class="result-count"><span>${filteredEntries().length} Monari</span><button data-action="clear-filters">Clear filters</button></div>
        <nav class="entry-list" aria-label="Monari entries">${renderList()}</nav>
        ${BACKEND_MODE ? '' : '<section class="source-note"><b>Local JSON source</b><code>data/monari-intake/batches/batch_001.json</code><p>Backend disabled. Export JSON is required for permanence.</p></section>'}
      </aside>
      <section class="review-pane">
        ${renderPersistenceNotice()}
        ${selected ? renderEditor(selected) : renderEmpty()}
      </section>
    </div>` : renderCodexView()}
    ${importPreview ? renderImportPreview() : ''}
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
      <span class="thumb"><img src="${escapeAttr(resolveEntryImage(entry))}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden title="${escapeAttr(resolveEntryImage(entry))}">✦</span></span>
      <span class="entry-copy"><b>${escapeHtml(formatCodexNo(entry.codex_no))} ${escapeHtml(entry.approved_name || 'Unnamed Monari')}</b><small>Stage ${entry.stage_number}</small><span class="badges"><i class="badge status-${entry.status}">${label(entry.status)}</i><i class="badge rarity">${escapeHtml(entry.rarity || 'Unrated')}</i></span></span>
      <span class="chevron">›</span>
    </button>`).join('');
}

function renderEditor(entry: MonariEntry): string {
  const total = stats.reduce((sum, [key]) => sum + Number(entry[key] || 0), 0);
  const entries = filteredEntries();
  const selectedIndex = entries.findIndex(candidate => candidate.id === entry.id);
  const resolvedImage = resolveEntryImage(entry);
  return `
    <div class="review-toolbar"><div class="review-title"><p class="eyebrow">${escapeHtml(formatCodexNo(entry.codex_no))}</p><h2>${escapeHtml(entry.approved_name || 'Unnamed Monari')}</h2></div><div class="entry-navigation"><button class="icon-button nav-button" data-action="previous" ${selectedIndex <= 0 ? 'disabled' : ''} aria-label="Previous entry">← <span>Previous</span></button><button class="icon-button nav-button" data-action="next" ${selectedIndex < 0 || selectedIndex >= entries.length - 1 ? 'disabled' : ''} aria-label="Next entry"><span>Next</span> →</button></div><div class="toolbar-actions"><button class="icon-button" data-action="speak" title="Pronounce name" aria-label="Pronounce name">◖))</button><select data-field="status" aria-label="Status">${options(MONARI_STATUSES, entry.status)}</select><button class="button primary" data-action="save">${BACKEND_MODE ? 'Save to Backend' : 'Save Locally'}</button></div></div>
    ${saveError ? `<div class="save-error" role="alert">${saveError}</div>` : ''}
    <div class="review-grid">
      <article class="visual-card">
        <div class="image-stage ${imageMissing ? 'missing' : ''}">
          <div class="image-grid"></div><img id="preview-image" src="${escapeAttr(resolvedImage)}" alt="${escapeAttr(entry.approved_name)} intake preview"><div class="placeholder"><span>✦</span><b>MONARIUM</b><small>Image preview unavailable</small></div>
          <span class="stage-chip">STAGE ${entry.stage_number}</span><span id="image-warning" class="image-warning">⚠ Image missing</span>
          ${BACKEND_MODE ? '<button class="image-replace-overlay" data-action="change-image" aria-label="Replace profile image"><span>↑</span> Replace Profile Image</button>' : ''}
        </div>
        <div class="image-controls"><div class="image-actions"><button class="button primary" data-action="change-image">${BACKEND_MODE ? 'Replace Profile Image' : 'Change Image Path'}</button><a class="button secondary" href="${escapeAttr(resolvedImage)}" target="_blank" rel="noreferrer" ${resolvedImage ? '' : 'aria-disabled="true"'}>Open Image</a></div><input id="image-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>${BACKEND_MODE ? '' : `<label class="image-path-field" hidden><span>Browser-visible image path</span><input id="image-path-input" value="${escapeAttr(entry.image_path)}" placeholder="/assets/monari/_incoming/batch_001/..."><small>Local preview only; export JSON and publish the image asset separately.</small></label>`}<p class="image-failure">Image failed to load.</p></div>
        <div class="visual-meta"><span><small>ELEMENT</small><b>${escapeHtml(entry.element_1 || '—')}${entry.element_2 ? ` / ${escapeHtml(entry.element_2)}` : ''}</b></span><span><small>RARITY</small><b>${escapeHtml(entry.rarity || '—')}</b></span><span><small>ROLE</small><b>${escapeHtml(entry.role || '—')}</b></span></div>
        <div class="ai-panel"><span>✦</span><div><p class="eyebrow">AI HELPER</p><b>AI Helper Coming Soon</b><small>Name, lore, taxonomy, and stat suggestions.</small></div><button class="button secondary" data-action="copy-prompt">Copy AI Rename Prompt</button></div>
      </article>
      <article class="editor-card">
        ${section('Identity', `<div class="field-grid identity-grid">${input('approved_name','Approved name',entry.approved_name)}${numberInput('codex_no','Codex No.',entry.codex_no)}${selectField('status','Review status',MONARI_STATUSES,entry.status)}${selectField('rarity','Rarity',MONARI_RARITIES,entry.rarity)}</div>`)}
        ${section('Profile', `<div class="read-grid profile-summary">${readField('Stage',String(entry.stage_number))}${readField('Evolves from',entry.evolves_from || '—')}${readField('Evolves to',entry.evolves_to || '—')}${readField('Evolution line ID',entry.evolution_line_id || '—')}</div><div class="field-grid">${selectField('asset_status','Asset status',MONARI_ASSET_STATUSES,entry.asset_status)}</div>`)}
        ${section('Classification', `<div class="field-grid three">${selectField('element_1','Element 1',MONARI_ELEMENTS,entry.element_1)}${selectField('element_2','Element 2',['', ...MONARI_ELEMENTS],entry.element_2)}${inputWithHint('role','Role',entry.role,'Admin guidance for stat direction; not a hard player restriction.')}${selectField('taxonomy_primary','Primary taxonomy',MONARI_TAXONOMIES,entry.taxonomy_primary)}${selectField('taxonomy_secondary','Secondary taxonomy',['', ...MONARI_TAXONOMIES],entry.taxonomy_secondary)}</div>`)}
        ${section('Stats', `<div class="stat-head"><span>7 Monarium attributes</span><b>Total <strong id="stat-total">${total}</strong></b></div><div class="stats-grid">${stats.map(([key,name]) => statInput(key,name,entry[key])).join('')}</div>`)}
        ${section('Lore & optional ability', `${textarea('description','Description / lore',entry.description)}<p class="section-note">Abilities are optional. Shared abilities suit most Monari; reserve signature abilities for select iconic or story-important designs.</p><div class="field-grid">${input('ability_name','Ability name (optional)',entry.ability_name)}${input('signature_moves','Signature moves (optional)',entry.signature_moves)}</div>${textarea('ability_description','Ability flavor description (optional)',entry.ability_description)}${textarea('ability_effect','In-game effect (optional)',entry.ability_effect)}<div class="field-grid">${textarea('ability_effect_tags','Ability effect tags (comma separated)',entry.ability_effect_tags)}${textarea('status_condition_suggestions','Status condition suggestions',entry.status_condition_suggestions)}</div><div class="field-grid">${textarea('tags','Tags (comma separated)',entry.tags)}${textarea('review_notes','Review notes',entry.review_notes)}</div><label class="confidence"><span>Confidence score</span><div><input data-field="confidence_score" type="range" min="0" max="1" step="0.01" value="${entry.confidence_score}"><output id="confidence-output">${Math.round(entry.confidence_score * 100)}%</output></div></label>`)}
        <details class="moveset-section"><summary>Learnable Moves / Moveset <span>Coming Soon</span></summary><div class="field-grid">${textarea('suggested_signature_moves','Suggested signature moves',entry.suggested_signature_moves)}${textarea('suggested_learnable_moves','Suggested learnable moves',entry.suggested_learnable_moves)}</div><p>Future recommendations will use element, taxonomy, tags, role, and evolution stage.</p></details>
        <div class="decision-bar"><div><p class="eyebrow">REVIEW DECISION</p><span>${BACKEND_MODE ? 'Save changes, or promote this reviewed entry to the official Codex.' : 'Update status, then save your local review.'}</span></div><div>${BACKEND_MODE ? '<button class="button approve" data-action="promote">Approve to Live Codex</button>' : ''}<button class="button needs-edit" data-status="needs_review">Needs Edit</button><button class="button reject" data-status="rejected">Reject</button><button class="button primary" data-action="save">${BACKEND_MODE ? 'Save to Backend' : 'Save Locally'}</button></div></div>
        <details class="backup-tools"><summary>Advanced / Debug</summary><p>${BACKEND_MODE ? 'Technical identifiers, slug controls, source metadata, and portable backup tools.' : 'Local metadata and export tools. Export is required to keep a permanent copy outside this browser.'}</p><div class="advanced-grid">${input('slug','Slug',entry.slug)}${checkbox('slug_locked','Lock manual slug',entry.slug_locked)}${input('habitat','Habitat / search metadata',entry.habitat)}${input('personality','Personality notes (optional)',entry.personality)}</div><div class="advanced-metadata">${readField('Import Entry ID',entry.id)}${readField('Source filename',entry.source_filename || '—')}${readField('Parent sheet',entry.parent_sheet_filename || '—')}${readField('Image URL',entry.image_url || '—')}${readField('Image path / object key',entry.image_path || '—')}</div><div class="advanced-actions"><button class="button secondary" data-action="export">${BACKEND_MODE ? 'Export JSON Backup' : 'Export Updated JSON'}</button><button class="button secondary" data-action="copy-image-url" ${resolvedImage ? '' : 'disabled'}>Copy Image URL</button></div>${resolvedImage ? `<details><summary>Resolved Preview URL</summary><code>${escapeHtml(resolvedImage)}</code></details>` : ''}</details>
      </article>
    </div>`;
}

function renderCodexView(): string {
  const visible = codexEntries.filter(entry => {
    const term = codexQuery.trim().toLowerCase();
    const matchesSearch = !term || [
      entry.name, entry.slug, entry.rarity, entry.element_1, entry.element_2,
      entry.taxonomy_primary, entry.taxonomy_secondary, String(entry.codex_no ?? ''),
    ].some(value => value.toLowerCase().includes(term.replace(/^#/, '')));
    return matchesSearch && (codexStatus ? entry.status === codexStatus : ['active', 'approved', 'published'].includes(entry.status));
  });
  const numbered = visible.filter(entry => entry.codex_no !== null);
  const unnumbered = visible.filter(entry => entry.codex_no === null);
  return `<section class="codex-page">
    <div class="codex-heading"><div><p class="eyebrow">OFFICIAL MONARIUM REGISTRY</p><h2>Live Codex</h2><p>Approved entries are ordered by their official Codex number. Active, approved, and published entries show by default. Hidden entries can be restored from the status filter.</p></div><div class="codex-filters"><label class="search"><span>⌕</span><input id="codex-search" type="search" value="${escapeAttr(codexQuery)}" placeholder="Search name, #, element, rarity, taxonomy…"></label>${filterSelect('codex-status', 'Active entries', ['active','published','approved','hidden','needs_review','draft','removed'], codexStatus)}</div></div>
    ${!BACKEND_MODE ? '<div class="persistence-notice"><b>Live Codex requires Backend Mode.</b></div>' : ''}
    <div class="codex-table-wrap"><table class="codex-table"><thead><tr><th>Codex</th><th>Monari</th><th>Rarity</th><th>Elements</th><th>Taxonomy</th><th>Stage / Evolution</th><th>Status</th><th>Asset</th><th>Actions</th></tr></thead><tbody>
      ${numbered.map(renderCodexRow).join('') || '<tr><td colspan="9" class="empty-list">No numbered Codex entries match.</td></tr>'}
      ${unnumbered.length ? `<tr class="unnumbered-heading"><th colspan="9">Unnumbered</th></tr>${unnumbered.map(renderCodexRow).join('')}` : ''}
    </tbody></table></div>
    ${codexPreviewId ? renderCodexPreview(codexEntries.find(entry => entry.id === codexPreviewId)) : ''}
  </section>`;
}

function renderCodexRow(entry: CodexEntry): string {
  const image = imageUrl(entry.image_url) || imageUrl(entry.image_path);
  return `<tr data-codex-row="${escapeAttr(entry.id)}">
    <td><input class="codex-number-edit" data-codex-field="codex_no" type="number" min="1" value="${entry.codex_no ?? ''}" aria-label="Codex number for ${escapeAttr(entry.name)}"><b>${formatCodexNo(entry.codex_no)}</b></td>
    <td><div class="codex-monari"><span class="thumb"><img src="${escapeAttr(image)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>✦</span></span><input data-codex-field="name" value="${escapeAttr(entry.name)}"></div></td>
    <td>${escapeHtml(entry.rarity || '—')}</td><td>${escapeHtml([entry.element_1, entry.element_2].filter(Boolean).join(' / ') || '—')}</td>
    <td>${escapeHtml([entry.taxonomy_primary, entry.taxonomy_secondary].filter(Boolean).join(' / ') || '—')}</td>
    <td>Stage ${entry.stage || '—'}<small>${escapeHtml(entry.evolution_line_id || 'No evolution line')}</small></td>
    <td><select data-codex-field="status">${options(['active','draft','approved','published','needs_review','hidden','removed'], entry.status)}</select></td>
    <td><span class="badge">${escapeHtml(label(entry.asset_status || 'missing'))}</span></td>
    <td><div class="row-actions"><button class="button primary" data-codex-action="view" data-id="${entry.id}">View</button><button class="button secondary" data-codex-action="edit" data-id="${entry.id}">Quick Edit</button><button class="button needs-edit" data-codex-action="send-back" data-id="${entry.id}">Send Back to Review Queue</button><button class="button reject" data-codex-action="remove" data-id="${entry.id}">Remove from Live Codex</button>${entry.status === 'hidden' ? `<button class="button approve" data-codex-action="restore" data-id="${entry.id}">Restore</button>` : ''}</div></td>
  </tr>`;
}


function renderCodexPreview(entry: CodexEntry | undefined): string {
  if (!entry) return '';
  const image = imageUrl(entry.image_url) || imageUrl(entry.image_path);
  const elementText = [entry.element_1, entry.element_2].filter(Boolean).join(' / ') || '—';
  const taxonomyText = [entry.taxonomy_primary, entry.taxonomy_secondary].filter(Boolean).join(' / ') || '—';
  const evolutionText = [entry.evolves_from && `From ${entry.evolves_from}`, entry.evolves_to && `To ${entry.evolves_to}`].filter(Boolean).join(' · ') || entry.evolution_line_id || 'Standalone line';
  const statRows = stats.map(([key, title]) => {
    const value = Number(entry[key] || 0);
    const pct = Math.max(0, Math.min(100, value / 1.5));
    return `<div class="codex-preview-stat"><span>${title}</span><i><b style="--stat-value:${pct}%"></b></i><strong>${value || '—'}</strong></div>`;
  }).join('');
  const ability = [entry.ability_name, entry.ability_description, entry.ability_effect].filter(Boolean).join(' — ');
  return `<div class="modal-backdrop"><section class="codex-preview-modal" role="dialog" aria-modal="true" aria-labelledby="codex-preview-title">
    <button class="icon-button codex-preview-close" data-codex-action="close-preview" data-id="${escapeAttr(entry.id)}" aria-label="Close preview">×</button>
    <div class="codex-preview-hero"><div><p class="eyebrow">PLAYER CODEX PREVIEW</p><h2 id="codex-preview-title">${escapeHtml(formatCodexNo(entry.codex_no))} ${escapeHtml(entry.name || 'Unnamed Monari')}</h2><div class="codex-preview-badges"><span>${escapeHtml(entry.rarity || 'Unrated')}</span><span>${escapeHtml(elementText)}</span><span>${escapeHtml(taxonomyText)}</span></div></div><small>${escapeHtml(label(entry.status))}${entry.asset_status ? ` · Asset ${escapeHtml(label(entry.asset_status))}` : ''}</small></div>
    <div class="codex-preview-body"><figure class="codex-preview-image"><img src="${escapeAttr(image)}" alt="${escapeAttr(entry.name)} profile image" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><figcaption hidden>✦</figcaption></figure>
    <div class="codex-preview-details"><section><h3>Profile</h3><dl><div><dt>Stage</dt><dd>${entry.stage || '—'}</dd></div><div><dt>Evolution</dt><dd>${escapeHtml(evolutionText)}</dd></div><div><dt>Habitat</dt><dd>${escapeHtml(entry.habitat || 'Unknown')}</dd></div><div><dt>Tags</dt><dd>${escapeHtml(entry.tags || '—')}</dd></div></dl></section><section><h3>Stats</h3><div class="codex-preview-stats">${statRows}</div></section><section><h3>Ability</h3><p>${escapeHtml(ability || 'No ability recorded yet.')}</p>${entry.signature_moves ? `<p><b>Signature:</b> ${escapeHtml(entry.signature_moves)}</p>` : ''}</section><section><h3>Lore</h3><p>${escapeHtml(entry.description || 'No Codex lore recorded yet.')}</p></section></div></div>
  </section></div>`;
}

function renderImportPreview(): string {
  const entries = Array.isArray(importPreview!.payload.entries) ? importPreview!.payload.entries as Array<Record<string, unknown>> : [];
  return `<div class="modal-backdrop"><section class="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><p class="eyebrow">JSON VALIDATION</p><h2 id="import-title">Import Batch Preview</h2>
    <dl><div><dt>File</dt><dd>${escapeHtml(importPreview!.filename)}</dd></div><div><dt>Batch</dt><dd>${escapeHtml(stringValue(importPreview!.payload.name, stringValue(importPreview!.payload.batch_key, 'Generated batch key')))}</dd></div><div><dt>Entries</dt><dd>${entries.length}</dd></div></dl>
    <div class="import-samples">${entries.slice(0, 5).map((entry, index) => `<span>${formatCodexNo(numberOrNull(entry.codex_no))} ${escapeHtml(stringValue(entry.approved_name, stringValue(entry.name, `Entry ${index + 1}`)))}</span>`).join('')}</div>
    ${importPreview!.errors.length ? `<div class="validation errors"><b>Errors</b>${importPreview!.errors.map(message => `<p>${escapeHtml(message)}</p>`).join('')}</div>` : ''}
    ${importPreview!.warnings.length ? `<div class="validation warnings"><b>Warnings</b>${importPreview!.warnings.map(message => `<p>${escapeHtml(message)}</p>`).join('')}</div>` : '<div class="validation valid"><b>Ready to import</b><p>No validation warnings.</p></div>'}
    <div class="modal-actions"><button class="button secondary" data-action="cancel-import">Cancel</button><button class="button primary" data-action="confirm-import" ${importPreview!.errors.length ? 'disabled' : ''}>Import as New Batch</button></div>
  </section></div>`;
}

function renderPersistenceNotice(): string {
  const sampleWarning = batch.data_status === 'sample'
    ? `<p class="sample-warning"><b>Sample data only:</b> ${batch.entries.length} of approximately ${batch.expected_entry_count ?? 41} expected Batch 001 rows are available. Replace the canonical file with the authoritative spreadsheet conversion before production review.</p>`
    : '';
  if (BACKEND_MODE && !sampleWarning) return '';
  return `<aside class="persistence-notice">
    <div><b>${BACKEND_MODE ? 'Dataset notice' : 'Browser-only working copy'}</b><p>${BACKEND_MODE ? '' : 'Backend disabled. Save keeps edits only in this browser, so JSON export is required for permanence.'}</p>${sampleWarning}</div>
    ${BACKEND_MODE ? '' : '<code>Replace: data/monari-intake/batches/batch_001.json</code>'}
  </aside>`;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(node => node.addEventListener('click', () => void changeView(node.dataset.view as 'intake' | 'codex')));
  document.querySelector<HTMLSelectElement>('#batch-select')?.addEventListener('change', event => void switchBatch((event.target as HTMLSelectElement).value));
  document.querySelector<HTMLInputElement>('#batch-file-input')?.addEventListener('change', event => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void previewImport(file);
  });
  document.querySelector<HTMLInputElement>('#codex-search')?.addEventListener('input', event => { codexQuery = (event.target as HTMLInputElement).value; render(); });
  document.querySelector<HTMLSelectElement>('#codex-status')?.addEventListener('change', event => { codexStatus = (event.target as HTMLSelectElement).value; render(); });
  document.querySelectorAll<HTMLElement>('[data-codex-action]').forEach(node => node.addEventListener('click', () => void handleCodexAction(node.dataset.codexAction ?? '', node.dataset.id ?? '')));
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
  const value = control.type === 'checkbox'
    ? (control as HTMLInputElement).checked
    : field === 'codex_no'
      ? numberOrNull(control.value)
      : numeric ? (control.value ? Number(control.value) : null) : control.value;
  (entry as unknown as Record<string, unknown>)[field] = value;
  dirty = true;
  saveError = '';
  if (stats.some(([key]) => key === field)) {
    const value = Math.max(0, Math.min(150, Number(control.value)));
    control.closest('.stat-row')?.querySelector<HTMLElement>('.stat-fill')?.style.setProperty('--stat-value', `${value / 1.5}%`);
    const total = stats.reduce((sum, [key]) => sum + Number(entry[key] || 0), 0);
    const totalNode = document.querySelector('#stat-total'); if (totalNode) totalNode.textContent = String(total);
  }
  if (field === 'confidence_score') { const output = document.querySelector('#confidence-output'); if (output) output.textContent = `${Math.round(Number(control.value) * 100)}%`; }
  if (field === 'approved_name') {
    const title = document.querySelector('.review-toolbar h2'); if (title) title.textContent = control.value || 'Unnamed Monari';
    if (!entry.slug_locked) entry.slug = slugify(control.value);
  }
  setSaveState('Unsaved changes');
}

function handleAction(action: string): void {
  if (action === 'save') void saveChanges();
  if (action === 'export') exportJson();
  if (action === 'speak') speakName();
  if (action === 'copy-prompt') void copyPrompt();
  if (action === 'copy-image-url') void copyImageUrl();
  if (action === 'previous') navigateEntry(-1);
  if (action === 'next') navigateEntry(1);
  if (action === 'promote') void promoteSelected();
  if (action === 'import-batch') document.querySelector<HTMLInputElement>('#batch-file-input')?.click();
  if (action === 'cancel-import') { importPreview = null; render(); }
  if (action === 'confirm-import') void confirmImport();
  if (action === 'change-image') {
    if (BACKEND_MODE) document.querySelector<HTMLInputElement>('#image-file-input')?.click();
    else {
      const field = document.querySelector<HTMLElement>('.image-path-field');
      if (field) { field.hidden = false; field.querySelector<HTMLInputElement>('input')?.focus(); }
    }
  }
  if (action === 'clear-filters') { query = ''; statusFilter = ''; rarityFilter = ''; taxonomyFilter = ''; elementFilter = ''; entryListScrollTop = 0; render(); }
}

async function refreshCodexEntries(): Promise<void> {
  if (!BACKEND_MODE) return;
  const result = await apiRequest<{ entries: CodexEntry[] }>('/api/codex/entries');
  codexEntries = result.entries.map(normalizeCodexEntry);
}

async function changeView(next: 'intake' | 'codex'): Promise<void> {
  if (next === view) return;
  if (dirty && !window.confirm('You have unsaved intake changes. Leave this view?')) return;
  view = next;
  if (view === 'codex' && BACKEND_MODE) {
    try {
      await refreshCodexEntries();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Could not load Live Codex'); }
  }
  render();
}

async function switchBatch(batchKey: string): Promise<void> {
  if (!BACKEND_MODE || batchKey === batch.batch_key) return;
  try {
    batch = normalizeBatch(await apiRequest(`/api/intake/batches/${encodeURIComponent(batchKey)}`));
    selectedId = batch.entries[0]?.id ?? '';
    query = ''; statusFilter = ''; rarityFilter = ''; taxonomyFilter = ''; elementFilter = '';
    dirty = false; render();
  } catch (error) { showToast(error instanceof Error ? error.message : 'Could not open batch'); }
}

async function promoteSelected(): Promise<void> {
  const entry = getSelected(); if (!entry) return;
  const validation = validatePromotion(entry);
  if (validation.length) { showToast(`Cannot promote: ${validation.join(', ')}`); return; }
  if (BACKEND_MODE || dirty) {
    const hadUnsavedChanges = dirty;
    await saveChanges();
    if (hadUnsavedChanges && dirty) return;
  }
  const allowUnnumbered = entry.codex_no === null && window.confirm('This entry has no Codex number. Promote it as Unnumbered?');
  if (entry.codex_no === null && !allowUnnumbered) { showToast('Assign a Codex No. or confirm Unnumbered'); return; }
  try {
    await apiRequest(`/api/codex/promote-intake/${encodeURIComponent(entry.id)}`, {
      method: 'POST', body: JSON.stringify({ allow_unnumbered: allowUnnumbered }),
    });
    entry.status = 'approved'; dirty = false;
    await refreshCodexEntries();
    showToast('Added to Live Codex');
  } catch (error) { showToast(error instanceof Error ? error.message : 'Codex promotion failed'); }
}

async function handleCodexAction(action: string, id: string): Promise<void> {
  const entry = codexEntries.find(item => item.id === id);
  if (action === 'close-preview') { codexPreviewId = ''; render(); return; }
  if (!entry) return;
  if (action === 'view') { codexPreviewId = id; render(); return; }
  if (action === 'edit') { editCodexEntry(entry); return; }
  if (action === 'remove' && !window.confirm(`Remove ${entry.name} from the default Live Codex list? The original intake entry will not be deleted.`)) return;
  try {
    if (action === 'save') {
      const row = document.querySelector<HTMLElement>(`[data-codex-row="${CSS.escape(id)}"]`);
      const patch: Record<string, unknown> = {};
      row?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-codex-field]').forEach(control => {
        patch[control.dataset.codexField!] = control.type === 'number' ? (control.value ? Number(control.value) : null) : control.value;
      });
      const result = await apiRequest<{ entry: CodexEntry }>(`/api/codex/entries/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
      Object.assign(entry, normalizeCodexEntry(result.entry)); showToast('Codex entry saved');
    } else {
      const endpoint = action === 'send-back' ? 'send-back' : action === 'restore' ? 'restore' : 'remove';
      const result = await apiRequest<{ entry: CodexEntry }>(`/api/codex/entries/${encodeURIComponent(id)}/${endpoint}`, { method: 'POST', body: '{}' });
      Object.assign(entry, normalizeCodexEntry(result.entry));
      showToast(action === 'send-back' ? 'Sent back to Review Queue' : action === 'restore' ? 'Codex entry restored' : 'Removed from default Live Codex');
    }
    render();
  } catch (error) { showToast(error instanceof Error ? error.message : 'Codex update failed'); }
}

function validatePromotion(entry: MonariEntry): string[] {
  const missing: string[] = [];
  if (!entry.approved_name.trim()) missing.push('approved name');
  if (entry.codex_no !== null && (!Number.isInteger(entry.codex_no) || entry.codex_no <= 0)) missing.push('Codex No. must be blank or greater than 0');
  if (!entry.rarity.trim()) missing.push('rarity');
  if (!entry.element_1.trim()) missing.push('element 1');
  if (!entry.taxonomy_primary.trim()) missing.push('primary taxonomy');
  if (!Number.isFinite(Number(entry.stage_number)) || Number(entry.stage_number) <= 0) missing.push('stage');
  if (!resolveEntryImage(entry)) missing.push('profile image or placeholder path');
  return missing;
}

async function previewImport(file: File): Promise<void> {
  try {
    const payload = JSON.parse(await file.text()) as Record<string, unknown>;
    const result = validateImport(payload);
    importPreview = { payload: result.payload, warnings: result.warnings, errors: result.errors, filename: file.name };
    render();
  } catch (error) {
    showToast(error instanceof SyntaxError ? 'The selected file is not valid JSON' : 'Could not read import file');
  }
}

async function confirmImport(): Promise<void> {
  if (!importPreview || importPreview.errors.length) return;
  try {
    const result = await apiRequest<{ batchKey: string; count: number }>('/api/intake/import-json', { method: 'POST', body: JSON.stringify(importPreview.payload) });
    const warnings = importPreview.warnings.length;
    importPreview = null;
    const list = await apiRequest<{ batches: Array<{ batch_key: string; name: string }> }>('/api/intake/batches');
    batches = list.batches;
    await switchBatch(result.batchKey);
    showToast(`Batch imported successfully · ${result.count} entries${warnings ? ` · ${warnings} warnings` : ''}`);
  } catch (error) { showToast(error instanceof Error ? error.message : 'Batch import failed'); }
}

function editCodexEntry(entry: CodexEntry): void {
  if (entry.intake_entry_id && batch.entries.some(item => item.id === entry.intake_entry_id)) {
    selectedId = entry.intake_entry_id;
    view = 'intake';
    codexPreviewId = '';
    render();
    return;
  }
  showToast('Matching intake entry is not in the active batch. Use row fields, then Save.');
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
  entry.image_url = '';
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
  saveError = '';
  try {
    const payload = toBackendEntry(entry);
    const result = await apiRequest<{ entry: Record<string, unknown> }>(`/api/intake/entries/${encodeURIComponent(entry.id)}`, { method: 'PATCH', body: JSON.stringify(payload) }, key);
    Object.assign(entry, normalizeEntry(result.entry, 0, new Date().toISOString()));
    dirty = false; window.onbeforeunload = null; setSaveState('Saved to Backend'); showToast('Saved to Backend');
  } catch (error) {
    setSaveState('Save failed');
    const requestError = error instanceof BackendRequestError ? error : undefined;
    const message = requestError?.status === 500 ? 'Backend save failed. Check Railway logs.' : error instanceof Error ? error.message : 'Backend save failed';
    saveError = requestError
      ? `<b>${escapeHtml(message)}</b><span><code>${escapeHtml(`${requestError.method} ${requestError.url}`)}</code> · Status ${requestError.status ?? 'No response'}${requestError.field ? ` · Field: <code>${escapeHtml(requestError.field)}</code>` : ''}</span>`
      : `<b>${escapeHtml(message)}</b>`;
    render({ preserveListScroll: true });
    showToast(message);
  }
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
  showToast(BACKEND_MODE ? 'JSON backup exported' : 'Permanent batch_001.json copy exported');
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
async function copyImageUrl(): Promise<void> {
  const entry = getSelected();
  const url = entry ? resolveEntryImage(entry) : '';
  if (!url) { showToast('No image URL to copy'); return; }
  try { await navigator.clipboard.writeText(url); showToast('Image URL copied'); } catch { showToast('Clipboard unavailable'); }
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
    slug_locked: Boolean(entry.slug_locked),
    codex_no: numberOrNull(entry.codex_no ?? entry.dex_no),
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
    image_url: imageUrl(stringValue(entry.image_url)),
    image_path: stringValue(entry.image_path, stringValue(entry.source_path)),
    pending_image_path: stringValue(entry.pending_image_path),
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
function resolveEntryImage(entry: Pick<MonariEntry, 'image_url' | 'image_path'>): string {
  const publicUrl = fullPublicImageUrl(entry.image_url);
  if (publicUrl) return publicUrl;
  const path = entry.image_path.trim().replace(/\\/g, '/');
  if (/^https?:\/\//i.test(path)) return path;
  if (/^\/(?:assets|data)\//i.test(path) || /^\/?public\/(?:assets|data)\//i.test(path)) return imageUrl(path);
  return '';
}
function fullPublicImageUrl(value: string): string { return /^https?:\/\//i.test(value.trim()) ? value.trim() : ''; }
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
  const method = init.method ?? 'GET';
  const url = `${API_URL}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': key, ...init.headers },
    });
  } catch (error) {
    throw new BackendRequestError(
      `Could not reach the backend. This may be a network or CORS error: ${error instanceof Error ? error.message : 'request failed'}`,
      method,
      url,
    );
  }
  if (response.status === 401) {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    throw new BackendRequestError('Admin key rejected. Enter the correct key and try again.', method, url, 401, await response.text());
  }
  if (!response.ok) {
    const responseBody = await response.text();
    const payload = parseErrorPayload(responseBody);
    throw new BackendRequestError(payload.message ?? `Backend request failed (${response.status})`, method, url, response.status, responseBody, payload.field);
  }
  return response.json() as Promise<T>;
}
async function checkBackendHealth(): Promise<void> {
  const method = 'GET';
  const url = `${API_URL}/health`;
  let response: Response;
  try {
    response = await fetch(url, { method, headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new BackendRequestError(
      `Backend health check could not reach Railway. This may be a network or CORS error: ${error instanceof Error ? error.message : 'request failed'}`,
      method,
      url,
    );
  }
  if (!response.ok) {
    const responseBody = await response.text();
    throw new BackendRequestError(parseErrorPayload(responseBody).message ?? `Backend health check failed (${response.status})`, method, url, response.status, responseBody);
  }
}
function toBackendEntry(entry: MonariEntry): Record<string, unknown> {
  const slug = entry.slug_locked && entry.slug ? entry.slug : slugify(entry.approved_name);
  const codexNo = numberOrNull(entry.codex_no);
  entry.slug = slug;
  entry.codex_no = codexNo;
  return {
    approved_name: entry.approved_name, slug, codex_no: codexNo, stage: entry.stage_number,
    evolves_from: entry.evolves_from, evolves_to: entry.evolves_to, evolution_line_id: entry.evolution_line_id,
    status: entry.status, rarity: entry.rarity, element_1: entry.element_1, element_2: entry.element_2,
    taxonomy_primary: entry.taxonomy_primary, taxonomy_secondary: entry.taxonomy_secondary, role: entry.role,
    hp: entry.hp, aura: entry.aura, attack: entry.attack, special_attack: entry.special_attack,
    defense: entry.defense, special_defense: entry.special_defense, speed: entry.speed,
    ability_name: entry.ability_name, ability_description: entry.ability_description, ability_effect: entry.ability_effect,
    ability_effect_tags: entry.ability_effect_tags, status_condition_suggestions: entry.status_condition_suggestions,
    suggested_signature_moves: entry.suggested_signature_moves, suggested_learnable_moves: entry.suggested_learnable_moves,
    description: entry.description, habitat: entry.habitat, personality: entry.personality, tags: entry.tags,
    confidence: entry.confidence_score, review_notes: entry.review_notes, asset_status: entry.asset_status,
    image_url: entry.image_url, image_path: entry.image_path,
  };
}
async function uploadImage(file: File): Promise<void> {
  const entry = getSelected(); if (!entry) return;
  if (!file.type.startsWith('image/')) { showToast('Choose a valid image file'); return; }
  if (file.size > MAX_IMAGE_BYTES) { showToast('Image is too large. Maximum size is 10 MB.'); return; }
  const safeFilename = sanitizeFilename(file.name);
  const key = getAdminKey('Enter the Monarium admin key to upload this image.');
  if (!key) { showToast('Upload cancelled: admin key required'); return; }
  setSaveState('Uploading image…');
  try {
    const signed = await apiRequest<{ uploadUrl: string; method: string; objectKey: string; publicUrl: string }>('/api/uploads/r2-presign', {
      method: 'POST', body: JSON.stringify({ entryId: entry.id, filename: safeFilename, contentType: file.type, assetKind: 'profile' }),
    }, key);
    const upload = await fetch(signed.uploadUrl, { method: signed.method, headers: { 'Content-Type': file.type }, body: file });
    if (!upload.ok) throw new Error(`R2 upload failed (${upload.status})`);
    const attached = await apiRequest<{ entry: Record<string, unknown> }>(`/api/intake/entries/${encodeURIComponent(entry.id)}/asset`, {
      method: 'POST', body: JSON.stringify({ assetKind: 'profile', objectKey: signed.objectKey, publicUrl: signed.publicUrl }),
    }, key);
    Object.assign(entry, normalizeEntry(attached.entry, 0, new Date().toISOString()));
    dirty = false; window.onbeforeunload = null;
    render({ preserveListScroll: true }); setSaveState('Image saved to Cloud Storage'); showToast('Image uploaded and saved');
  } catch (error) { setSaveState('Upload failed'); showToast(error instanceof Error ? error.message : 'Image upload failed'); }
}
function getSelected(): MonariEntry | undefined { return batch.entries.find(entry => entry.id === selectedId); }
function bindFilter(id: string, assign: (value: string) => void): void {
  document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.addEventListener('input', event => {
    assign((event.target as HTMLInputElement).value); entryListScrollTop = 0;
    if (id === 'search') refreshFilteredList(); else render();
  });
}
function refreshFilteredList(): void {
  const list = document.querySelector<HTMLElement>('.entry-list');
  const count = document.querySelector<HTMLElement>('.result-count span');
  if (list) { list.innerHTML = renderList(); list.scrollTop = 0; }
  if (count) count.textContent = `${filteredEntries().length} Monari`;
  document.querySelectorAll<HTMLElement>('[data-select]').forEach(node => node.addEventListener('click', () => selectEntry(node.dataset.select ?? '')));
}
function setSaveState(text: string): void { const node = document.querySelector('#save-state'); if (node) node.textContent = text; }
function showToast(text: string): void { const toast = document.querySelector<HTMLElement>('#toast'); if (!toast) return; toast.textContent = text; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2200); }
function renderEmpty(): string { return `<div class="empty-review"><span>✦</span><h2>Select a Monari</h2><p>Choose an intake row to begin review.</p></div>`; }
function section(title: string, content: string): string { return `<section class="form-section"><h3>${title}</h3>${content}</section>`; }
function input(field: keyof MonariEntry, title: string, value: string): string { return `<label><span>${title}</span><input data-field="${field}" value="${escapeAttr(value)}"></label>`; }
function numberInput(field: keyof MonariEntry, title: string, value: number | null): string { return `<label><span>${title}</span><input data-field="${field}" type="text" inputmode="numeric" value="${value ?? ''}" placeholder="#001"><small class="field-hint">${formatCodexNo(value)}</small></label>`; }
function checkbox(field: keyof MonariEntry, title: string, checked: boolean): string { return `<label class="checkbox-field"><input data-field="${field}" type="checkbox" ${checked ? 'checked' : ''}><span>${title}</span></label>`; }
function inputWithHint(field: keyof MonariEntry, title: string, value: string, hint: string): string { return `<label><span>${title}</span><input data-field="${field}" value="${escapeAttr(value)}"><small class="field-hint">${escapeHtml(hint)}</small></label>`; }
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
function normalizeApiUrl(value: string): string {
  if (!value) return '';
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`;
  try {
    const url = new URL(withProtocol);
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return withProtocol.replace(/\/+$/, '');
  }
}
function parseErrorPayload(value: string): { message?: string; field?: string } {
  try {
    const payload = JSON.parse(value) as { message?: unknown; error?: unknown; field?: unknown };
    return {
      message: typeof payload.message === 'string' ? payload.message : typeof payload.error === 'string' ? payload.error : undefined,
      field: typeof payload.field === 'string' ? payload.field : undefined,
    };
  } catch {
    return { message: value.trim() || undefined };
  }
}
function renderBackendDiagnostics(error?: BackendRequestError): string {
  return `<dl class="backend-diagnostics">
    <div><dt>Backend API URL</dt><dd><code>${escapeHtml(API_URL)}</code></dd></div>
    <div><dt>Backend health</dt><dd class="${backendHealthPassed ? 'diagnostic-ok' : 'diagnostic-failed'}">${backendHealthPassed ? 'OK' : 'FAILED'}</dd></div>
    ${error ? `<div><dt>Failed request</dt><dd><code>${escapeHtml(`${error.method} ${error.url}`)}</code></dd></div>
    <div><dt>Status</dt><dd>${error.status ?? 'No HTTP response'}</dd></div>
    ${error.responseBody ? `<div><dt>Response</dt><dd><pre>${escapeHtml(error.responseBody)}</pre></dd></div>` : ''}
    ${error.status === 404 ? '<div><dt>Meaning</dt><dd>Route missing or frontend/backend endpoint mismatch.</dd></div>' : ''}` : ''}
  </dl>`;
}
function sanitizeFilename(value: string): string {
  const parts = value.trim().split('.');
  const extension = parts.length > 1 ? `.${parts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
  const stem = parts.join('.').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'profile';
  return `${stem.slice(0, 100)}${extension}`;
}

function formatCodexNo(value: number | null): string {
  return value === null || !Number.isFinite(value) ? 'Unnumbered ·' : `#${String(value).padStart(3, '0')}`;
}
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unnumbered') return null;
    const parsed = Number(trimmed.replace(/^#\s*/, ''));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  return null;
}
function slugify(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}
function normalizeCodexEntry(value: CodexEntry): CodexEntry {
  return { ...value, codex_no: numberOrNull(value.codex_no), stage: numberValue(value.stage, 1), hp: numberValue(value.hp), aura: numberValue(value.aura), attack: numberValue(value.attack), special_attack: numberValue(value.special_attack), defense: numberValue(value.defense), special_defense: numberValue(value.special_defense), speed: numberValue(value.speed) };
}
function validateImport(source: Record<string, unknown>): { payload: Record<string, unknown>; warnings: string[]; errors: string[] } {
  const payload = structuredClone(source);
  const warnings: string[] = [];
  const errors: string[] = [];
  if (!stringValue(payload.batch_key)) {
    payload.batch_key = `batch_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${slugify(stringValue(payload.name, 'import'))}`;
    warnings.push(`No batch_key was supplied; generated ${payload.batch_key}.`);
  }
  if (!Array.isArray(payload.entries) || !payload.entries.length) {
    errors.push('The JSON must contain a non-empty entries array.');
    return { payload, warnings, errors };
  }
  const seenNumbers = new Map<number, number>();
  payload.entries.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) { errors.push(`Entry ${index + 1} is not an object.`); return; }
    const entry = item as Record<string, unknown>;
    if (!stringValue(entry.approved_name, stringValue(entry.name))) errors.push(`Entry ${index + 1} needs approved_name or name.`);
    if (entry.rarity === 'Ancient') { entry.rarity = 'Ultra Rare'; warnings.push(`Entry ${index + 1}: Ancient normalized to Ultra Rare.`); }
    const rarity = stringValue(entry.rarity);
    if (rarity && !MONARI_RARITIES.includes(rarity as typeof MONARI_RARITIES[number])) warnings.push(`Entry ${index + 1}: ${rarity} is not an official rarity.`);
    if (entry.element_1 === 'Shadow') { entry.element_1 = 'Dark'; warnings.push(`Entry ${index + 1}: Shadow normalized to Dark.`); }
    for (const field of ['element_1', 'element_2']) {
      const element = stringValue(entry[field]);
      if (element && !MONARI_ELEMENTS.includes(element as typeof MONARI_ELEMENTS[number])) warnings.push(`Entry ${index + 1}: ${element} is not an official element and will require review.`);
    }
    const taxonomy = stringValue(entry.taxonomy_primary);
    if (taxonomy && !MONARI_TAXONOMIES.includes(taxonomy as typeof MONARI_TAXONOMIES[number])) warnings.push(`Entry ${index + 1}: ${taxonomy} is not an official taxonomy.`);
    for (const field of stats.map(([key]) => key)) {
      if (entry[field] !== undefined && !Number.isFinite(Number(entry[field]))) errors.push(`Entry ${index + 1}: ${field} must be numeric.`);
    }
    const suppliedStats = stats.map(([key]) => Number(entry[key])).filter(Number.isFinite);
    if (suppliedStats.length === stats.length) {
      const total = suppliedStats.reduce((sum, value) => sum + value, 0);
      if (total < 140 || total > 1050) warnings.push(`Entry ${index + 1}: total stats (${total}) are outside the expected review range.`);
    }
    const codexNo = numberOrNull(entry.codex_no);
    if (codexNo !== null) {
      if (seenNumbers.has(codexNo)) warnings.push(`Codex ${formatCodexNo(codexNo)} is duplicated in entries ${seenNumbers.get(codexNo)! + 1} and ${index + 1}.`);
      seenNumbers.set(codexNo, index);
    }
  });
  return { payload, warnings, errors };
}
