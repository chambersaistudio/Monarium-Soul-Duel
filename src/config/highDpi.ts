import Phaser from 'phaser';

/**
 * High-DPI rendering support.
 *
 * Phaser 3.80 has no built-in renderer resolution setting, and ScaleManager
 * `zoom` changes the coordinate space (breaking hardcoded pixel values in
 * scenes). Instead we:
 *
 *  1. Keep the Phaser game size (and therefore all scene layout code) in CSS
 *     pixels — scenes need zero changes.
 *  2. Size the canvas drawing buffer to CSS × DPR so the GPU has real pixels
 *     to fill instead of upscaling a small buffer (the source of mobile blur).
 *  3. Shim every camera: viewport = buffer size, zoom = DPR, origin = (0,0).
 *     Zooming from the top-left corner maps the CSS-pixel world exactly onto
 *     the full buffer — no scroll compensation needed, and camera effects
 *     (fade/flash) and any future scrolling keep working.
 *  4. Set ScaleManager.displayScale to DPR so pointer coordinates arrive in
 *     buffer pixels — the same space the camera hit-test expects, keeping
 *     interactive objects tap-accurate. Code that needs CSS-pixel pointer
 *     positions must read pointer.worldX/worldY (correct in both spaces).
 *
 * The camera shim runs every PRE_RENDER with cheap per-property checks, so
 * cameras created by newly started scenes are corrected before their first
 * rendered frame.
 */

export const MAX_RENDER_DPR = 2;

export function getRenderDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.max(1, Math.min(MAX_RENDER_DPR, Number(window.devicePixelRatio) || 1));
}

export function viewportCssSize(game?: Phaser.Game): { width: number; height: number } {
  if (typeof window !== 'undefined') {
    const vv = window.visualViewport;
    const w  = Math.round(vv?.width  ?? window.innerWidth);
    const h  = Math.round(vv?.height ?? window.innerHeight);
    if (w > 1 && h > 1) return { width: w, height: h };
  }
  // Non-browser / test fallback: Phaser's current logical size
  if (game?.scale) {
    return {
      width:  Math.max(1, Math.round(game.scale.gameSize.width)),
      height: Math.max(1, Math.round(game.scale.gameSize.height)),
    };
  }
  return { width: 1, height: 1 };
}

function syncCanvasStyles(canvas: HTMLCanvasElement, css: { width: number; height: number }): void {
  if (canvas.style.width !== `${css.width}px`)   canvas.style.width  = `${css.width}px`;
  if (canvas.style.height !== `${css.height}px`) canvas.style.height = `${css.height}px`;
}

function shimCamera(camera: Phaser.Cameras.Scene2D.Camera, renderW: number, renderH: number, dpr: number): void {
  if (camera.x !== 0 || camera.y !== 0 || camera.width !== renderW || camera.height !== renderH) {
    camera.setViewport(0, 0, renderW, renderH);
  }
  if (camera.zoom !== dpr) camera.setZoom(dpr);
  // Zoom scales around the camera origin; (0,0) anchors the CSS-pixel world
  // to the buffer's top-left so nothing shifts off screen.
  if (camera.originX !== 0 || camera.originY !== 0) camera.setOrigin(0, 0);
}

let lastLoggedKey = '';

export function applyHighDpiCanvas(game: Phaser.Game, reason = 'sync'): void {
  const canvas = game.canvas;
  if (!canvas || !game.renderer) return;

  const dpr     = getRenderDpr();
  const css     = viewportCssSize(game);
  const renderW = Math.max(1, Math.round(css.width  * dpr));
  const renderH = Math.max(1, Math.round(css.height * dpr));

  // Phaser logical size tracks the viewport in CSS pixels.
  // NOTE: scale.resize() resets the canvas buffer and displayScale, so the
  // buffer/displayScale overrides below must come after it.
  if (Math.round(game.scale.gameSize.width)  !== css.width ||
      Math.round(game.scale.gameSize.height) !== css.height) {
    game.scale.resize(css.width, css.height);
  }

  syncCanvasStyles(canvas, css);

  if (canvas.width !== renderW || canvas.height !== renderH ||
      game.renderer.width !== renderW || game.renderer.height !== renderH) {
    canvas.width  = renderW;
    canvas.height = renderH;
    game.renderer.resize(renderW, renderH);
  }

  // Pointer coords: page CSS px → buffer px, matching camera screen space.
  game.scale.displayScale.set(dpr, dpr);

  for (const scene of game.scene.scenes) {
    const cams = scene.cameras?.cameras;
    if (!cams) continue;
    for (const cam of cams) shimCamera(cam, renderW, renderH, dpr);
  }

  const logKey = `${css.width}x${css.height}@${dpr}`;
  if (logKey !== lastLoggedKey) {
    lastLoggedKey = logKey;
    console.info('[highDpi]', { reason, viewport: `${css.width}x${css.height}`, buffer: `${renderW}x${renderH}`, dpr });
  }
}

/**
 * Renders Phaser Text objects at DPR resolution so glyphs stay sharp inside
 * the DPR-sized buffer. Must be installed before any scene creates text.
 */
export function installHighDpiText(): void {
  const dpr = getRenderDpr();
  if (dpr <= 1) return;

  const proto = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (...args: unknown[]) => Phaser.GameObjects.Text;
    __highDpiText?: boolean;
  };
  if (proto.__highDpiText) return;
  proto.__highDpiText = true;

  const original = proto.text;
  proto.text = function (this: unknown, ...args: unknown[]): Phaser.GameObjects.Text {
    return original.apply(this, args).setResolution(dpr);
  };
}
