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

// Unlock Web Audio API on first interaction (required by iOS Safari)
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
