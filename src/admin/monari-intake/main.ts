import './styles.css';
import { MONARI_STATUSES, type IntakeBatch, type MonariEntry, type MonariStatus } from './types';

declare global {
  interface ImportMeta {
    readonly env: {
      readonly DEV: boolean;
      readonly VITE_ENABLE_ADMIN?: string;
    };
  }
}

const DATA_URL = '/data/monari-intake/batches/batch_001.json';
const STORAGE_KEY = 'monarium:admin:monari-intake:batch_001';
const ADMIN_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_ADMIN === 'true';
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
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Batch request failed (${response.status})`);
    const source = await response.json() as IntakeBatch;
    const saved = localStorage.getItem(STORAGE_KEY);
    batch = saved ? JSON.parse(saved) as IntakeBatch : source;
    selectedId = batch.entries[0]?.id ?? '';
    render();
  } catch (error) {
    app.innerHTML = `<section class="disabled"><span>DATA LOAD ERROR</span><h1>Batch 001 unavailable</h1><p>${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</p><code>${DATA_URL}</code></section>`;
  }
}

function render(): void {
  const selected = getSelected();
  app.innerHTML = `
    <header class="admin-header">
      <div><p class="eyebrow">MONARIUM STUDIO · PRIVATE DEV TOOL</p><h1>Intake Review</h1></div>
      <div class="batch-summary"><span class="live-dot"></span><div><b>${escapeHtml(batch.name)}</b><small>${escapeHtml(batch.status)} · ${batch.entries.length} entries</small></div></div>
      <div class="header-actions"><span id="save-state">${dirty ? 'Unsaved changes' : 'Saved locally'}</span><button class="button secondary" data-action="export">Export Updated JSON</button></div>
    </header>
    <div class="admin-layout">
      <aside class="library-panel">
        <label class="batch-picker"><span>Active batch</span><select><option>${escapeHtml(batch.name)}</option></select><small>Imported ${formatDate(batch.imported_at)}</small></label>
        <label class="search"><span>⌕</span><input id="search" type="search" value="${escapeAttr(query)}" placeholder="Search name, tag, ID…" /></label>
        <div class="filters">
          ${filterSelect('status-filter', 'All statuses', unique(batch.entries.map(entry => entry.status)), statusFilter)}
          ${filterSelect('rarity-filter', 'All rarities', unique(batch.entries.map(entry => entry.rarity)), rarityFilter)}
          ${filterSelect('taxonomy-filter', 'All taxonomies', unique(batch.entries.map(entry => entry.taxonomy_primary)), taxonomyFilter)}
          ${filterSelect('element-filter', 'All elements', unique(batch.entries.flatMap(entry => [entry.element_1, entry.element_2])), elementFilter)}
        </div>
        <div class="result-count"><span>${filteredEntries().length} Monari</span><button data-action="clear-filters">Clear filters</button></div>
        <nav class="entry-list" aria-label="Monari entries">${renderList()}</nav>
        <section class="source-note"><b>Local JSON source</b><code>data/monari-intake/batches/batch_001.json</code><p>Google Sheet and Drive sync are reserved for Phase 2.</p></section>
      </aside>
      <section class="review-pane">${selected ? renderEditor(selected) : renderEmpty()}</section>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>`;
  bindEvents();
}

function renderList(): string {
  const entries = filteredEntries();
  if (!entries.length) return `<div class="empty-list">No Monari match these filters.</div>`;
  return entries.map(entry => `
    <button class="entry-item ${entry.id === selectedId ? 'selected' : ''}" data-select="${escapeAttr(entry.id)}">
      <span class="thumb"><img src="${escapeAttr(entry.image_path)}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>✦</span></span>
      <span class="entry-copy"><b>${escapeHtml(entry.approved_name || 'Unnamed Monari')}</b><small>${escapeHtml(entry.id)} · Stage ${entry.stage_number}</small><span class="badges"><i class="badge status-${entry.status}">${label(entry.status)}</i><i class="badge rarity">${escapeHtml(entry.rarity || 'Unrated')}</i></span></span>
      <span class="chevron">›</span>
    </button>`).join('');
}

function renderEditor(entry: MonariEntry): string {
  const total = stats.reduce((sum, [key]) => sum + Number(entry[key] || 0), 0);
  return `
    <div class="review-toolbar"><div><p class="eyebrow">ENTRY ${escapeHtml(entry.id)}</p><h2>${escapeHtml(entry.approved_name || 'Unnamed Monari')}</h2></div><div class="toolbar-actions"><button class="icon-button" data-action="speak" title="Pronounce name" aria-label="Pronounce name">◖))</button><select data-field="status" aria-label="Status">${options(MONARI_STATUSES, entry.status)}</select><button class="button primary" data-action="save">Save</button></div></div>
    <div class="review-grid">
      <article class="visual-card">
        <div class="image-stage ${imageMissing ? 'missing' : ''}">
          <div class="image-grid"></div><img id="preview-image" src="${escapeAttr(entry.image_path)}" alt="${escapeAttr(entry.approved_name)} intake preview"><div class="placeholder"><span>✦</span><b>MONARIUM</b><small>Image preview unavailable</small></div>
          <span class="stage-chip">STAGE ${entry.stage_number}</span><span id="image-warning" class="image-warning">⚠ Image missing</span>
        </div>
        <div class="visual-meta"><span><small>ELEMENT</small><b>${escapeHtml(entry.element_1 || '—')}${entry.element_2 ? ` / ${escapeHtml(entry.element_2)}` : ''}</b></span><span><small>RARITY</small><b>${escapeHtml(entry.rarity || '—')}</b></span><span><small>ROLE</small><b>${escapeHtml(entry.role || '—')}</b></span></div>
        <div class="future-tools"><div><p class="eyebrow">IMAGE WORKSPACE</p><b>Asset tools coming soon</b><small>Replace · Clean profile · Generate portrait · Update Codex image</small></div><button disabled>Manage image</button></div>
        <div class="ai-panel"><span>✦</span><div><p class="eyebrow">AI HELPER</p><b>AI Helper Coming Soon</b><small>Name, lore, taxonomy, and stat suggestions.</small></div><button class="button secondary" data-action="copy-prompt">Copy AI Rename Prompt</button></div>
      </article>
      <article class="editor-card">
        ${section('Identity', `<div class="field-grid identity-grid">${input('approved_name','Approved name',entry.approved_name)}${input('slug','Slug',entry.slug)}${selectField('status','Review status',MONARI_STATUSES,entry.status)}${input('rarity','Rarity',entry.rarity)}</div>`)}
        ${section('Profile', `<div class="read-grid">${readField('Source filename',entry.source_filename)}${readField('Parent sheet',entry.parent_sheet_filename)}${readField('Evolution line ID',entry.evolution_line_id)}${readField('Stage',String(entry.stage_number))}${readField('Evolves from',entry.evolves_from || '—')}${readField('Evolves to',entry.evolves_to || '—')}</div><div class="field-grid three">${input('asset_status','Asset status',entry.asset_status)}${input('habitat','Habitat',entry.habitat)}${input('personality','Personality',entry.personality)}</div>`)}
        ${section('Classification', `<div class="field-grid three">${input('element_1','Element 1',entry.element_1)}${input('element_2','Element 2',entry.element_2)}${input('role','Role',entry.role)}${input('taxonomy_primary','Primary taxonomy',entry.taxonomy_primary)}${input('taxonomy_secondary','Secondary taxonomy',entry.taxonomy_secondary)}</div>`)}
        ${section('Stats', `<div class="stat-head"><span>7 Monarium attributes</span><b>Total <strong id="stat-total">${total}</strong></b></div><div class="stats-grid">${stats.map(([key,name]) => statInput(key,name,entry[key])).join('')}</div>`)}
        ${section('Abilities & lore', `<div class="field-grid">${input('ability','Ability',entry.ability)}${input('signature_moves','Signature moves',entry.signature_moves)}</div>${textarea('description','Description',entry.description)}<div class="field-grid">${textarea('tags','Tags (comma separated)',entry.tags)}${textarea('review_notes','Review notes',entry.review_notes)}</div><label class="confidence"><span>Confidence score</span><div><input data-field="confidence_score" type="range" min="0" max="1" step="0.01" value="${entry.confidence_score}"><output id="confidence-output">${Math.round(entry.confidence_score * 100)}%</output></div></label>`)}
        <div class="decision-bar"><div><p class="eyebrow">REVIEW DECISION</p><span>Update status, then save your local review.</span></div><div><button class="button approve" data-status="approved">Approve</button><button class="button needs-edit" data-status="needs_review">Needs Edit</button><button class="button reject" data-status="rejected">Reject</button><button class="button primary" data-action="save">Save Changes</button></div></div>
      </article>
    </div>`;
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-select]').forEach(node => node.addEventListener('click', () => { selectedId = node.dataset.select ?? ''; imageMissing = false; render(); }));
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
  if (action === 'save') saveLocal();
  if (action === 'export') exportJson();
  if (action === 'speak') speakName();
  if (action === 'copy-prompt') void copyPrompt();
  if (action === 'clear-filters') { query = ''; statusFilter = ''; rarityFilter = ''; taxonomyFilter = ''; elementFilter = ''; render(); }
}

function updateStatus(status: MonariStatus): void {
  const entry = getSelected(); if (!entry) return;
  entry.status = status; dirty = true; saveLocal(); render(); showToast(`Marked ${label(status)}`);
}

function saveLocal(): void {
  const entry = getSelected();
  if (entry) entry.updated_at = new Date().toISOString();
  batch.updated_at = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(batch)); dirty = false; window.onbeforeunload = null;
  setSaveState('Saved locally'); showToast('Review saved in this browser');
}

function exportJson(): void {
  saveLocal();
  const blob = new Blob([`${JSON.stringify(batch, null, 2)}\n`], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${batch.id}.json`; link.click(); URL.revokeObjectURL(link.href);
  showToast('Updated batch JSON exported');
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
function getSelected(): MonariEntry | undefined { return batch.entries.find(entry => entry.id === selectedId); }
function bindFilter(id: string, assign: (value: string) => void): void { document.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)?.addEventListener('input', event => { assign((event.target as HTMLInputElement).value); render(); }); }
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
function options(values: readonly string[], selected: string): string { return values.filter(Boolean).map(value => `<option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label(value))}</option>`).join(''); }
function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))].sort(); }
function label(value: string): string { return value.replace(/_/g,' ').replace(/\b\w/g, (char: string) => char.toUpperCase()); }
function formatDate(value: string): string { return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char] ?? char)); }
function escapeAttr(value: string): string { return escapeHtml(value); }
