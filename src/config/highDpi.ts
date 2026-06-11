import Phaser from 'phaser';

export const MAX_RENDER_DPR = 2;

export function getRenderDpr(): number {
  if (typeof window === 'undefined') return 1;
  const dpr = Number(window.devicePixelRatio) || 1;
  return Math.max(1, Math.min(MAX_RENDER_DPR, dpr));
}

export function cssCanvasSize(canvas: HTMLCanvasElement, game?: Phaser.Game): { width: number; height: number } {
  // Prefer Phaser's CSS-pixel scale size over the current canvas bounds.
  // The bounds can be stale for a frame during mobile orientation changes,
  // and reusing them here can pin the canvas to the previous orientation.
  const scale = game?.scale;
  const scaleW = scale ? Math.round(scale.gameSize.width || scale.displaySize.width) : 0;
  const scaleH = scale ? Math.round(scale.gameSize.height || scale.displaySize.height) : 0;
  const viewportW = typeof window !== 'undefined' ? Math.round(window.visualViewport?.width ?? window.innerWidth) : 0;
  const viewportH = typeof window !== 'undefined' ? Math.round(window.visualViewport?.height ?? window.innerHeight) : 0;
  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, scaleW || viewportW || Math.round(rect.width || canvas.clientWidth || canvas.width)),
    height: Math.max(1, scaleH || viewportH || Math.round(rect.height || canvas.clientHeight || canvas.height)),
  };
}

export function applyHighDpiCanvas(game: Phaser.Game): void {
  const canvas = game.canvas;
  if (!canvas) return;

  const dpr = getRenderDpr();
  const css = cssCanvasSize(canvas, game);
  const renderW = Math.max(1, Math.round(css.width * dpr));
  const renderH = Math.max(1, Math.round(css.height * dpr));

  canvas.style.width = `${css.width}px`;
  canvas.style.height = `${css.height}px`;

  if (canvas.width !== renderW || canvas.height !== renderH) {
    canvas.width = renderW;
    canvas.height = renderH;
    game.renderer.resize(renderW, renderH);
  }

  game.scene.scenes.forEach(scene => {
    if (!scene.sys.settings.visible) return;
    scene.cameras.cameras.forEach(camera => {
      camera.setViewport(0, 0, renderW, renderH);
      camera.setZoom(dpr);
    });
  });
}

export interface RenderDiagnostics {
  dpr: number;
  canvasCss: string;
  canvasInternal: string;
  phaserGameSize: string;
  phaserBaseSize: string;
  phaserDisplaySize: string;
  rendererSize: string;
  sceneKey: string;
}

export function getRenderDiagnostics(scene: Phaser.Scene): RenderDiagnostics {
  const canvas = scene.game.canvas;
  const css = cssCanvasSize(canvas, scene.game);
  const scale = scene.scale;
  return {
    dpr: getRenderDpr(),
    canvasCss: `${css.width}x${css.height}`,
    canvasInternal: `${canvas.width}x${canvas.height}`,
    phaserGameSize: `${Math.round(scale.gameSize.width)}x${Math.round(scale.gameSize.height)}`,
    phaserBaseSize: `${Math.round(scale.baseSize.width)}x${Math.round(scale.baseSize.height)}`,
    phaserDisplaySize: `${Math.round(scale.displaySize.width)}x${Math.round(scale.displaySize.height)}`,
    rendererSize: `${scene.game.renderer.width}x${scene.game.renderer.height}`,
    sceneKey: scene.scene.key,
  };
}
