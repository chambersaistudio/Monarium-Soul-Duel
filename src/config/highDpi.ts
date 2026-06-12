import Phaser from 'phaser';

export const MAX_RENDER_DPR = 2;

// Scenes that lay out in renderer-pixel coordinates (zoom = 1).
// All other scenes use CSS-pixel coordinates and receive a DPR zoom shim.
// Add a scene key here only after verifying its create() uses renderer dimensions.
const RENDERER_SPACE_SCENES = new Set<string>([
  // Reserved for future renderer-space scenes.
]);

let lastLoggedKey = '';
let lastRendererKey = '';

export function getRenderDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.min(MAX_RENDER_DPR, Number(window.devicePixelRatio) || 1));
}

export function viewportCssSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1, height: 1 };
  const vv = window.visualViewport;
  return {
    width:  Math.max(1, Math.round(vv?.width  ?? window.innerWidth)),
    height: Math.max(1, Math.round(vv?.height ?? window.innerHeight)),
  };
}

export function cssCanvasSize(canvas: HTMLCanvasElement, game?: Phaser.Game): { width: number; height: number } {
  void canvas;
  const vp = viewportCssSize();
  if (vp.width <= 1 && vp.height <= 1 && game?.scale) {
    return {
      width:  Math.max(1, Math.round(game.scale.gameSize.width  || game.scale.displaySize.width)),
      height: Math.max(1, Math.round(game.scale.gameSize.height || game.scale.displaySize.height)),
    };
  }
  return vp;
}

function applyCanvasStyles(canvas: HTMLCanvasElement, css: { width: number; height: number }): void {
  const parent = canvas.parentElement as HTMLElement | null;
  if (parent && parent !== document.body) {
    parent.style.width    = `${css.width}px`;
    parent.style.height   = `${css.height}px`;
    parent.style.overflow = 'hidden';
    parent.style.position = parent.style.position || 'fixed';
  }
  canvas.style.display       = 'block';
  canvas.style.position      = 'fixed';
  canvas.style.left          = '0';
  canvas.style.top           = '0';
  canvas.style.margin        = '0';
  canvas.style.padding       = '0';
  canvas.style.width         = `${css.width}px`;
  canvas.style.height        = `${css.height}px`;
  canvas.style.maxWidth      = 'none';
  canvas.style.maxHeight     = 'none';
  canvas.style.transform     = 'none';
  canvas.style.transformOrigin = '0 0';
}

export function applyHighDpiCanvas(game: Phaser.Game, reason = 'sync'): void {
  const canvas = game.canvas;
  if (!canvas) return;

  const dpr     = getRenderDpr();
  const css     = cssCanvasSize(canvas, game);
  const renderW = Math.max(1, Math.round(css.width  * dpr));
  const renderH = Math.max(1, Math.round(css.height * dpr));

  applyCanvasStyles(canvas, css);

  // Keep Phaser coordinate system in CSS pixels
  if (Math.round(game.scale.gameSize.width)  !== css.width ||
      Math.round(game.scale.gameSize.height) !== css.height) {
    game.scale.resize(css.width, css.height);
  }

  // Resize the drawing buffer to DPR dimensions
  if (canvas.width  !== renderW || canvas.height !== renderH ||
      game.renderer.width !== renderW || game.renderer.height !== renderH) {
    canvas.width  = renderW;
    canvas.height = renderH;
    game.renderer.resize(renderW, renderH);
  }

  // Apply zoom shim only when renderer dimensions change
  const rendererKey = `${renderW}x${renderH}@${dpr}`;
  if (rendererKey !== lastRendererKey) {
    lastRendererKey = rendererKey;
    game.scene.scenes.forEach(scene => {
      scene.cameras?.cameras.forEach(camera => {
        camera.setViewport(0, 0, renderW, renderH);
        camera.setZoom(RENDERER_SPACE_SCENES.has(scene.scene.key) ? 1 : dpr);
      });
    });
  }

  const logKey = `${css.width}x${css.height}@${dpr}`;
  if (logKey !== lastLoggedKey) {
    lastLoggedKey = logKey;
    console.info('[highDpi]', {
      reason,
      viewport: `${css.width}x${css.height}`,
      buffer:   `${renderW}x${renderH}`,
      dpr,
    });
  }
}
