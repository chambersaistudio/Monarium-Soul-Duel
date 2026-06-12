import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { OverworldScene } from './scenes/OverworldScene';
import { BattleScene } from './scenes/BattleScene';
import { ClassicSoulDuelScene } from './scenes/ClassicSoulDuelScene';
import { ClassicOverworldScene } from './scenes/ClassicOverworldScene';
import { BattleLabScene } from './scenes/BattleLabScene';
import { BattleLabSetupScene } from './scenes/BattleLabSetupScene';
import { applyHighDpiCanvas, getRenderDpr } from './config/highDpi';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  backgroundColor: '#0a0a0f',
  parent: document.body,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 800 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    ModeSelectScene,
    ClassicOverworldScene,
    ClassicSoulDuelScene,
    BattleLabScene,
    BattleLabSetupScene,
    OverworldScene,
    BattleScene,
  ],
  scale: {
    // RESIZE: canvas always matches the viewport exactly — no letterbox bars.
    // All scene positions are proportional to this.scale.width/height.
    // NOTE: Do NOT set scale.zoom to devicePixelRatio here — that divides the
    // game coordinate space by DPR (so this.scale.width becomes cssWidth/dpr),
    // breaking all hardcoded pixel values throughout the codebase.
    mode: Phaser.Scale.RESIZE,
    parent: document.body,
  },
  render: {
    antialias:   true,
    antialiasGL: true,
    pixelArt:    false,
  },
  input: {
    activePointers: 3,  // support simultaneous touch points for D-pad
  },
  disableContextMenu: true,
};

const game = new Phaser.Game(config);

// ── DPR-aware canvas sync ─────────────────────────────────────────────────────
// Keeps the canvas drawing buffer at CSS × DPR pixels while the Phaser
// coordinate system stays in CSS pixels.  The camera zoom shim (zoom = DPR)
// ensures all scenes render at native resolution without changing any scene
// coordinate code.  See src/config/highDpi.ts for implementation details.
let viewportSyncTimer: ReturnType<typeof setTimeout> | undefined;

function syncViewport(reason: string): void {
  applyHighDpiCanvas(game, reason);
}

function scheduleViewportSync(reason: string): void {
  syncViewport(reason);
  requestAnimationFrame(() => syncViewport(`${reason}:raf`));
  clearTimeout(viewportSyncTimer);
  viewportSyncTimer = setTimeout(() => syncViewport(`${reason}:settled`), 250);
}

game.events.once(Phaser.Core.Events.READY, () => {
  syncViewport('ready');
  console.info('[render]', { dpr: getRenderDpr(), buf: `${game.canvas.width}x${game.canvas.height}` });
});

// Sync on every frame — lightweight guard inside applyHighDpiCanvas skips
// camera updates when renderer dimensions haven't changed.
game.events.on(Phaser.Core.Events.PRE_RENDER, () => syncViewport('pre-render'));

window.addEventListener('resize',            () => scheduleViewportSync('window-resize'),       { passive: true });
window.addEventListener('orientationchange', () => scheduleViewportSync('orientationchange'),    { passive: true });
window.visualViewport?.addEventListener('resize', () => scheduleViewportSync('vvp-resize'),      { passive: true });
window.visualViewport?.addEventListener('scroll', () => scheduleViewportSync('vvp-scroll'),      { passive: true });

// ── Web Audio unlock (required by iOS Safari) ──────────────────────────────────
function tryUnlockAudio(): void {
  try {
    if (game.sound instanceof Phaser.Sound.WebAudioSoundManager) {
      const ctx = game.sound.context;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
  } catch { /* ok — sound manager not ready yet */ }
}
document.addEventListener('touchstart', tryUnlockAudio, { once: true, passive: true });
document.addEventListener('pointerdown', tryUnlockAudio, { once: true, passive: true });

// ── Viewport debug overlay (?debug=1) ──────────────────────────────────────────
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
  const dbg = document.createElement('div');
  dbg.id = 'debug-overlay';
  document.body.appendChild(dbg);

  const updateDebug = () => {
    const canvas  = game.canvas;
    const vv      = window.visualViewport;
    const body    = document.body;
    const scenes  = game.scene.scenes
      .filter(s => s.scene.isActive())
      .map(s => s.scene.key)
      .join(', ') || 'none';
    const orient  = screen.orientation?.type ?? 'n/a';

    dbg.textContent = [
      `win      ${window.innerWidth}×${window.innerHeight}`,
      `vvp      ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : 'n/a'}`,
      `body     ${body.offsetWidth}×${body.offsetHeight}`,
      `canvas   ${canvas.style.width}×${canvas.style.height}  (CSS)`,
      `canvas   ${canvas.width}×${canvas.height}  (buf)`,
      `phaser   ${Math.round(game.scale.width)}×${Math.round(game.scale.height)}`,
      `dpr      ${window.devicePixelRatio}`,
      `orient   ${orient}`,
      `scenes   ${scenes}`,
      `boot     ${!!document.getElementById('boot-overlay')}`,
    ].join('\n');
  };

  game.events.once('ready', () => setInterval(updateDebug, 400));
}
