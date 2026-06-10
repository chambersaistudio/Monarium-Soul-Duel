/**
 * Normalized battle HUD layout — all coords are 0–1 fractions of canvas w/h.
 * Call computePixelLayout(cfg, w, h) to get pixel values at runtime.
 *
 * Two explicit modes — desktop and mobileLandscape — each with its own
 * positions, sizes, and spacing. Mobile is NOT a compressed desktop.
 */

export interface HudRect {
  x: number; // left edge (0–1 of canvas width)
  y: number; // top edge  (0–1 of canvas height)
  w: number; // width     (0–1 of canvas width)
  h: number; // height    (0–1 of canvas height)
}

export interface HudPoint {
  x: number; // (0–1 of canvas width)
  y: number; // (0–1 of canvas height) — used as feet/baseline anchor
}

export interface BattleHudLayoutConfig {
  playerStatus: HudRect;
  enemyStatus:  HudRect;
  /** Turn badge rectangle, centred at top */
  turnBadge:    HudRect;
  /** Feet / baseline anchor for each Monari sprite */
  playerMonari: HudPoint;
  enemyMonari:  HudPoint;
  /** Y fraction for the arena floor / ground line */
  groundY:      number;
  /** Command button row (FIGHT / BAG / BOND / RUN) */
  commandRow:   HudRect;
  /** Player soul-sync bar (bottom-left) */
  soulbondBar:  HudRect;
  /** Enemy soul-sync bar (bottom-right) */
  soulsyncBar:  HudRect;
}

export interface PixelLayout {
  playerStatus: { x: number; y: number; w: number; h: number };
  enemyStatus:  { x: number; y: number; w: number; h: number };
  turnBadge:    { x: number; y: number; w: number; h: number };
  playerMonari: { x: number; y: number };
  enemyMonari:  { x: number; y: number };
  groundY:      number;
  commandRow:   { x: number; y: number; w: number; h: number };
  soulbondBar:  { x: number; y: number; w: number; h: number };
  soulsyncBar:  { x: number; y: number; w: number; h: number };
}

// ── Desktop 16:9 (960 × 600 reference) ───────────────────────────────────────
export const DESKTOP_BATTLE_HUD: BattleHudLayoutConfig = {
  playerStatus: { x: 0.008, y: 0.010, w: 0.265, h: 0.155 },
  enemyStatus:  { x: 0.727, y: 0.010, w: 0.265, h: 0.155 },
  turnBadge:    { x: 0.420, y: 0.008, w: 0.160, h: 0.150 },
  playerMonari: { x: 0.215, y: 0.710 },
  enemyMonari:  { x: 0.785, y: 0.710 },
  groundY:      0.710,
  commandRow:   { x: 0.030, y: 0.780, w: 0.940, h: 0.145 },
  soulbondBar:  { x: 0.020, y: 0.930, w: 0.305, h: 0.058 },
  soulsyncBar:  { x: 0.675, y: 0.930, w: 0.305, h: 0.058 },
};

// ── Mobile landscape (e.g. 844 × 390, 932 × 430) ─────────────────────────────
// Tighter top panels, lower Monari, smaller turn badge — own positions, not
// a scaled-down desktop layout.
export const MOBILE_LANDSCAPE_BATTLE_HUD: BattleHudLayoutConfig = {
  playerStatus: { x: 0.008, y: 0.015, w: 0.240, h: 0.135 },
  enemyStatus:  { x: 0.752, y: 0.015, w: 0.240, h: 0.135 },
  turnBadge:    { x: 0.440, y: 0.010, w: 0.120, h: 0.130 },
  playerMonari: { x: 0.210, y: 0.690 },
  enemyMonari:  { x: 0.790, y: 0.690 },
  groundY:      0.690,
  commandRow:   { x: 0.040, y: 0.770, w: 0.920, h: 0.140 },
  soulbondBar:  { x: 0.020, y: 0.920, w: 0.285, h: 0.068 },
  soulsyncBar:  { x: 0.695, y: 0.920, w: 0.285, h: 0.068 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function scaleRect(r: HudRect, cw: number, ch: number) {
  return { x: r.x * cw, y: r.y * ch, w: r.w * cw, h: r.h * ch };
}

function scalePoint(p: HudPoint, cw: number, ch: number) {
  return { x: p.x * cw, y: p.y * ch };
}

export function computePixelLayout(
  cfg: BattleHudLayoutConfig,
  canvasW: number,
  canvasH: number,
): PixelLayout {
  return {
    playerStatus: scaleRect(cfg.playerStatus, canvasW, canvasH),
    enemyStatus:  scaleRect(cfg.enemyStatus,  canvasW, canvasH),
    turnBadge:    scaleRect(cfg.turnBadge,    canvasW, canvasH),
    playerMonari: scalePoint(cfg.playerMonari, canvasW, canvasH),
    enemyMonari:  scalePoint(cfg.enemyMonari,  canvasW, canvasH),
    groundY:      cfg.groundY * canvasH,
    commandRow:   scaleRect(cfg.commandRow,   canvasW, canvasH),
    soulbondBar:  scaleRect(cfg.soulbondBar,  canvasW, canvasH),
    soulsyncBar:  scaleRect(cfg.soulsyncBar,  canvasW, canvasH),
  };
}
