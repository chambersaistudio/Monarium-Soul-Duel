import { viewportCssSize } from '../config/highDpi';

const DEBUG_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

function el<T extends HTMLElement>(id: string): T | null {
  return typeof document === 'undefined' ? null : document.getElementById(id) as T | null;
}

function applyViewportBox(node: HTMLElement | null): void {
  if (!node) return;
  const vp = viewportCssSize();
  node.style.width = `${vp.width}px`;
  node.style.height = `${vp.height}px`;
}

export function layoutDomOverlays(): void {
  applyViewportBox(el('game'));
  applyViewportBox(el('boot-overlay'));
  applyViewportBox(el('mobile-debug-overlay'));
}

export function setBootLoading(progress: number, status = 'Loading assets…', safeMode = false): void {
  const overlay = el<HTMLDivElement>('boot-overlay');
  if (!overlay) return;
  layoutDomOverlays();
  overlay.hidden = false;
  overlay.dataset.state = 'loading';
  overlay.style.pointerEvents = 'auto';
  el<HTMLDivElement>('boot-progress-fill')?.style.setProperty('width', `${Math.max(0, Math.min(100, progress * 100))}%`);
  const statusEl = el<HTMLDivElement>('boot-status');
  if (statusEl) statusEl.textContent = status;
  const hintEl = el<HTMLDivElement>('boot-hint');
  if (hintEl) hintEl.textContent = safeMode ? 'Safe mobile loading mode' : 'Preparing Soul Duel';
  const startBtn = el<HTMLButtonElement>('boot-start-button');
  if (startBtn) startBtn.hidden = true;
}

export function showStartOverlay(onStart: () => void): void {
  const overlay = el<HTMLDivElement>('boot-overlay');
  if (!overlay) return;
  layoutDomOverlays();
  overlay.hidden = false;
  overlay.dataset.state = 'start';
  overlay.style.pointerEvents = 'auto';
  el<HTMLDivElement>('boot-progress-fill')?.style.setProperty('width', '100%');
  const statusEl = el<HTMLDivElement>('boot-status');
  if (statusEl) statusEl.textContent = 'Ready';
  const hintEl = el<HTMLDivElement>('boot-hint');
  if (hintEl) hintEl.textContent = 'Tap Start to enter Monarium';
  const startBtn = el<HTMLButtonElement>('boot-start-button');
  if (startBtn) {
    startBtn.hidden = false;
    startBtn.onclick = (event) => {
      event.preventDefault();
      onStart();
    };
    window.setTimeout(() => startBtn.focus({ preventScroll: true }), 0);
  }
}

export function hideBootOverlay(): void {
  const overlay = el<HTMLDivElement>('boot-overlay');
  if (!overlay) return;
  overlay.hidden = true;
  overlay.style.pointerEvents = 'none';
  const startBtn = el<HTMLButtonElement>('boot-start-button');
  if (startBtn) startBtn.onclick = null;
}

export function isBootOverlayActive(): boolean {
  const overlay = el<HTMLDivElement>('boot-overlay');
  return !!overlay && !overlay.hidden;
}

export interface DomDebugValues {
  reason: string;
  scene?: string;
  viewport: string;
  windowSize: string;
  dpr: number;
  canvasCss: string;
  canvasStyle: string;
  canvasInternal: string;
  parentSize: string;
  renderer: string;
  scale: string;
  gameSize: string;
  baseSize: string;
  displaySize: string;
  cameraZoom?: string;
  cameraViewport?: string;
}

export function updateMobileDebugOverlay(values: DomDebugValues): void {
  if (!DEBUG_ENABLED) return;
  const overlay = el<HTMLPreElement>('mobile-debug-overlay');
  if (!overlay) return;
  layoutDomOverlays();
  overlay.hidden = false;
  overlay.textContent = [
    `[viewport-sync] ${values.reason}`,
    `scene ${values.scene ?? 'n/a'} bootOverlay ${isBootOverlayActive()}`,
    `visualViewport ${values.viewport} window ${values.windowSize} DPR ${values.dpr}`,
    `parent ${values.parentSize}`,
    `canvas css ${values.canvasCss} style ${values.canvasStyle} internal ${values.canvasInternal}`,
    `renderer ${values.renderer}`,
    `scale ${values.scale} game ${values.gameSize} base ${values.baseSize} display ${values.displaySize}`,
    `camera z${values.cameraZoom ?? 'n/a'} vp ${values.cameraViewport ?? 'n/a'}`,
  ].join('\n');
}
