import Phaser from 'phaser';

export const MAX_RENDER_DPR = 2;

let lastAppliedKey = '';
let lastLoggedKey = '';
const DEBUG_ENABLED = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

export function getRenderDpr(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = Number(window.devicePixelRatio) || 1;
  return Math.max(1, Math.min(MAX_RENDER_DPR, dpr));
}

export function viewportCssSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1, height: 1 };
  const vv = window.visualViewport;
  return {
    width: Math.max(1, Math.round(vv?.width ?? window.innerWidth)),
    height: Math.max(1, Math.round(vv?.height ?? window.innerHeight)),
  };
}

export function cssCanvasSize(canvas: HTMLCanvasElement, game?: Phaser.Game): { width: number; height: number } {
  void canvas;
  // The Phaser canvas must visually match the *current* mobile viewport. During
  // rotation, canvas bounds and ScaleManager values can both be one event behind,
  // so visualViewport is the source of truth and window.inner* is the fallback.
  const viewport = viewportCssSize();

  // In non-browser test environments, fall back to Phaser's CSS-pixel game size.
  if (viewport.width <= 1 && viewport.height <= 1 && game?.scale) {
    return {
      width: Math.max(1, Math.round(game.scale.gameSize.width || game.scale.displaySize.width)),
      height: Math.max(1, Math.round(game.scale.gameSize.height || game.scale.displaySize.height)),
    };
  }

  return viewport;
}

function applyDomViewportStyles(canvas: HTMLCanvasElement, css: { width: number; height: number }): void {
  if (typeof document !== 'undefined') {
    const html = document.documentElement;
    const body = document.body;
    html.style.width = '100%';
    html.style.height = '100%';
    html.style.margin = '0';
    html.style.overflow = 'hidden';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.margin = '0';
    body.style.overflow = 'hidden';
  }

  const parent = canvas.parentElement as HTMLElement | null;
  if (parent) {
    parent.style.width = `${css.width}px`;
    parent.style.height = `${css.height}px`;
    parent.style.margin = '0';
    parent.style.padding = '0';
    parent.style.overflow = 'hidden';
    parent.style.position = parent === document.body ? 'fixed' : (parent.style.position || 'fixed');
    parent.style.left = '0';
    parent.style.top = '0';
  }

  canvas.style.display = 'block';
  canvas.style.position = 'fixed';
  canvas.style.left = '0';
  canvas.style.top = '0';
  canvas.style.margin = '0';
  canvas.style.padding = '0';
  canvas.style.width = `${css.width}px`;
  canvas.style.height = `${css.height}px`;
  canvas.style.maxWidth = 'none';
  canvas.style.maxHeight = 'none';
  canvas.style.transform = 'none';
  canvas.style.transformOrigin = '0 0';
}


function updateDomDebug(game: Phaser.Game, reason: string, css: { width: number; height: number }, dpr: number): void {
  if (!DEBUG_ENABLED || typeof document === 'undefined') return;
  const overlay = document.getElementById('mobile-debug-overlay') as HTMLPreElement | null;
  if (!overlay) return;
  const canvas = game.canvas;
  const rect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const activeScenes = game.scene.getScenes(true);
  const scene = activeScenes[activeScenes.length - 1];
  const camera = scene?.cameras?.main;
  overlay.hidden = false;
  overlay.style.width = `${css.width}px`;
  overlay.style.height = `${css.height}px`;
  overlay.textContent = [
    `[viewport-sync] ${reason}`,
    `scene ${scene?.scene.key ?? 'n/a'} bootOverlay ${!(document.getElementById('boot-overlay') as HTMLElement | null)?.hidden} modeOverlay ${!(document.getElementById('mode-select-overlay') as HTMLElement | null)?.hidden} storyOverlay ${!!(document.getElementById('story-ui-overlay') as HTMLElement | null) && !(document.getElementById('story-ui-overlay') as HTMLElement).hidden}`,
    `visualViewport ${css.width}x${css.height} window ${window.innerWidth}x${window.innerHeight} DPR ${dpr}`,
    `parent ${parentRect ? `${Math.round(parentRect.width)}x${Math.round(parentRect.height)}` : 'none'}`,
    `canvas css ${Math.round(rect.width)}x${Math.round(rect.height)} style ${canvas.style.width}x${canvas.style.height} internal ${canvas.width}x${canvas.height}`,
    `renderer ${game.renderer.width}x${game.renderer.height}`,
    `scale ${Math.round(game.scale.width)}x${Math.round(game.scale.height)} game ${Math.round(game.scale.gameSize.width)}x${Math.round(game.scale.gameSize.height)} base ${Math.round(game.scale.baseSize.width)}x${Math.round(game.scale.baseSize.height)} display ${Math.round(game.scale.displaySize.width)}x${Math.round(game.scale.displaySize.height)}`,
    `camera z${camera?.zoom.toFixed(2) ?? 'n/a'} vp ${camera ? `${Math.round(camera.x)},${Math.round(camera.y)} ${Math.round(camera.width)}x${Math.round(camera.height)}` : 'n/a'}`,
  ].join('\n');
}

export function applyHighDpiCanvas(game: Phaser.Game, reason = 'sync'): void {
  const canvas = game.canvas;
  if (!canvas) return;

  const dpr = getRenderDpr();
  const css = cssCanvasSize(canvas, game);
  const renderW = Math.max(1, Math.round(css.width * dpr));
  const renderH = Math.max(1, Math.round(css.height * dpr));

  applyDomViewportStyles(canvas, css);

  if (Math.round(game.scale.gameSize.width) !== css.width || Math.round(game.scale.gameSize.height) !== css.height) {
    game.scale.resize(css.width, css.height);
  }

  if (canvas.width !== renderW || canvas.height !== renderH || game.renderer.width !== renderW || game.renderer.height !== renderH) {
    canvas.width = renderW;
    canvas.height = renderH;
    game.renderer.resize(renderW, renderH);
  }

  game.scene.scenes.forEach(scene => {
    scene.cameras?.cameras.forEach(camera => {
      camera.setViewport(0, 0, renderW, renderH);
      camera.setZoom(dpr);
    });
  });

  const key = `${css.width}x${css.height}@${dpr}:${renderW}x${renderH}:${reason}`;
  if (key !== lastAppliedKey) {
    lastAppliedKey = key;
  }

  updateDomDebug(game, reason, css, dpr);

  const logKey = `${css.width}x${css.height}@${dpr}:${renderW}x${renderH}`;
  if (logKey !== lastLoggedKey) {
    lastLoggedKey = logKey;
    const parentRect = canvas.parentElement?.getBoundingClientRect();
    console.info('[viewport-sync]', {
      reason,
      viewport: `${css.width}x${css.height}`,
      canvasCss: `${Math.round(canvas.getBoundingClientRect().width)}x${Math.round(canvas.getBoundingClientRect().height)}`,
      canvasStyle: `${canvas.style.width}x${canvas.style.height}`,
      canvasInternal: `${canvas.width}x${canvas.height}`,
      parent: parentRect ? `${Math.round(parentRect.width)}x${Math.round(parentRect.height)}` : 'none',
      scale: `${Math.round(game.scale.width)}x${Math.round(game.scale.height)}`,
      renderer: `${game.renderer.width}x${game.renderer.height}`,
      dpr,
    });
  }
}

export interface RenderDiagnostics {
  dpr: number;
  viewportSize: string;
  canvasCss: string;
  canvasRect: string;
  canvasStyle: string;
  canvasInternal: string;
  parentSize: string;
  parentRect: string;
  phaserGameSize: string;
  phaserBaseSize: string;
  phaserDisplaySize: string;
  rendererSize: string;
  cameraZoom: string;
  cameraScroll: string;
  cameraViewport: string;
  sceneKey: string;
}

export function getRenderDiagnostics(scene: Phaser.Scene): RenderDiagnostics {
  const canvas = scene.game.canvas;
  const css = cssCanvasSize(canvas, scene.game);
  const rect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const scale = scene.scale;
  const camera = scene.cameras.main;
  return {
    dpr: getRenderDpr(),
    viewportSize: `${css.width}x${css.height}`,
    canvasCss: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
    canvasRect: `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
    canvasStyle: `${canvas.style.width}x${canvas.style.height}`,
    canvasInternal: `${canvas.width}x${canvas.height}`,
    parentSize: parentRect ? `${Math.round(parentRect.width)}x${Math.round(parentRect.height)}` : 'none',
    parentRect: parentRect ? `${Math.round(parentRect.x)},${Math.round(parentRect.y)} ${Math.round(parentRect.width)}x${Math.round(parentRect.height)}` : 'none',
    phaserGameSize: `${Math.round(scale.gameSize.width)}x${Math.round(scale.gameSize.height)}`,
    phaserBaseSize: `${Math.round(scale.baseSize.width)}x${Math.round(scale.baseSize.height)}`,
    phaserDisplaySize: `${Math.round(scale.displaySize.width)}x${Math.round(scale.displaySize.height)}`,
    rendererSize: `${scene.game.renderer.width}x${scene.game.renderer.height}`,
    cameraZoom: camera.zoom.toFixed(2),
    cameraScroll: `${Math.round(camera.scrollX)},${Math.round(camera.scrollY)}`,
    cameraViewport: `${Math.round(camera.x)},${Math.round(camera.y)} ${Math.round(camera.width)}x${Math.round(camera.height)}`,
    sceneKey: scene.scene.key,
  };
}
