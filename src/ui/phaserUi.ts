import Phaser from 'phaser';
import { UI_THEME } from '../config/uiTheme';

export type UiObj = Phaser.GameObjects.GameObject & { destroy(fromScene?: boolean): void };

export function ensurePlaceholderTexture(scene: Phaser.Scene, key: string, color = 0x8c5cff): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x0b0b18, 1).fillRoundedRect(0, 0, 96, 96, 18);
  g.lineStyle(3, color, 0.75).strokeRoundedRect(2, 2, 92, 92, 16);
  g.fillStyle(color, 0.18).fillCircle(48, 44, 28);
  g.fillStyle(UI_THEME.colors.whiteGold, 0.95).fillCircle(48, 36, 12);
  g.fillStyle(UI_THEME.colors.whiteGold, 0.72).fillRoundedRect(26, 54, 44, 20, 10);
  g.generateTexture(key, 96, 96);
  g.destroy();
  return key;
}

export function preloadVisualCandidates(scene: Phaser.Scene, kind: 'monari' | 'character', id: string, paths: string[]): void {
  const names = ['profile', 'fullBody', 'battleIdle', 'portrait', 'icon', 'reference'];
  const queuedPaths = new Set<string>();
  paths.forEach((path, index) => {
    if (queuedPaths.has(path)) return;
    queuedPaths.add(path);
    const key = `${kind}_${id}_${names[index] ?? `candidate${index}`}`;
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
}

export function bestLoadedVisualKey(scene: Phaser.Scene, kind: 'monari' | 'character', id: string, placeholderColor?: number): string {
  const keys = [`${kind}_${id}_profile`, `${kind}_${id}_fullBody`, `${kind}_${id}_battleIdle`, `${kind}_${id}_portrait`, `${kind}_${id}_icon`, `${kind}_${id}_reference`];
  return keys.find(k => scene.textures.exists(k)) ?? ensurePlaceholderTexture(scene, `generated_${kind}_${id}`, placeholderColor);
}

export function drawGlassPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { radius?: number; fill?: number; stroke?: number; alpha?: number; glow?: number } = {},
): void {
  const r = opts.radius ?? UI_THEME.panels.radius;
  const fill = opts.fill ?? UI_THEME.colors.panel;
  const stroke = opts.stroke ?? UI_THEME.colors.stroke;
  g.fillStyle(opts.glow ?? UI_THEME.colors.purple, UI_THEME.panels.glowAlpha);
  g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, r + 3);
  g.fillStyle(fill, opts.alpha ?? UI_THEME.panels.alpha);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(1.5, stroke, UI_THEME.panels.strokeAlpha);
  g.strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(1, 0xffffff, 0.08);
  g.lineBetween(x + r, y + 2, x + w - r, y + 2);
}

export function drawMeter(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: number,
  label?: string,
): void {
  const r = Math.max(3, h / 2);
  g.fillStyle(UI_THEME.bars.track, 0.88).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(fill, 0.95).fillRoundedRect(x, y, Math.max(h, w * Phaser.Math.Clamp(ratio, 0, 1)), h, r);
  g.lineStyle(1, 0xffffff, 0.12).strokeRoundedRect(x, y, w, h, r);
  if (label) {
    g.fillStyle(0xffffff, 0.45).fillRect(x + 4, y + 2, Math.max(0, w - 8), 1);
  }
}
