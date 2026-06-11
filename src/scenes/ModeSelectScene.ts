import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';
import { applyHighDpiCanvas } from '../config/highDpi';
import { hideModeSelectOverlay, layoutDomOverlays, showModeSelectOverlay, type ModeOverlayOption } from '../ui/bootOverlay';

const BASE_MODES: ModeOverlayOption[] = [
  {
    key:  'StoryOverworldScene',
    name: 'Classic / Story',
    desc: 'Explore the world, bond Monari, and challenge rivals.',
  },
  {
    key:  'OverworldScene',
    name: 'Duel',
    desc: 'Jump into the real-time arena duel prototype.',
  },
  {
    key:  'BattleLabSetupScene',
    name: 'Battle Lab',
    desc: 'Set up a quick battle and test moves, levels, and damage.',
  },
];

const DEBUG_MODES: ModeOverlayOption[] = [
  {
    key:  'BattleLabScene',
    name: 'Formula Debugger',
    desc: 'Damage calculation sandbox for debugging.',
  },
];

const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
const MODES = isDebugMode ? [...BASE_MODES, ...DEBUG_MODES] : BASE_MODES;

export class ModeSelectScene extends Phaser.Scene {
  private audio!: AudioManager;
  private cursor = 0;
  private upKey!: Phaser.Input.Keyboard.Key;
  private downKey!: Phaser.Input.Keyboard.Key;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private routing = false;

  constructor() { super({ key: 'ModeSelectScene' }); }

  create(): void {
    this.routing = false;
    this.cursor = 0;

    // Intentionally no Phaser mode-select UI here. The visible/tappable mode
    // screen is a DOM overlay so it stays centered during mobile rotation while
    // Phaser canvas resizing settles behind it.
    this.cameras.main.setBackgroundColor('#05050a');

    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    showModeSelectOverlay(
      MODES,
      (key) => this.routeToMode(key),
      () => this.returnToTitle(),
    );

    this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.routing) hideModeSelectOverlay();
    });
  }

  private focusCurrentButton(): void {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('#mode-options .mode-option'));
    buttons[this.cursor]?.focus({ preventScroll: true });
  }

  private routeToMode(key: string): void {
    if (this.routing) return;
    this.routing = true;
    this.audio.playUi(AUDIO_KEYS.ui.confirm);
    hideModeSelectOverlay();

    // The game scenes are canvas-backed, unlike the DOM boot/mode overlays.
    // Force the visualViewport -> #game -> canvas -> ScaleManager -> renderer
    // chain to settle before scene creation so Overworld doesn't build from an
    // old top-left canvas rectangle on mobile rotation.
    layoutDomOverlays();
    applyHighDpiCanvas(this.game, `mode-select:${key}:sync-now`);
    requestAnimationFrame(() => {
      layoutDomOverlays();
      applyHighDpiCanvas(this.game, `mode-select:${key}:sync-raf`);
      window.setTimeout(() => {
        layoutDomOverlays();
        applyHighDpiCanvas(this.game, `mode-select:${key}:sync-settled`);
        this.scene.start(key);
      }, 80);
    });
  }

  private returnToTitle(): void {
    if (this.routing) return;
    this.routing = true;
    hideModeSelectOverlay();
    this.scene.start('TitleScene');
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
      this.cursor = (this.cursor - 1 + MODES.length) % MODES.length;
      this.audio.playUi(AUDIO_KEYS.ui.move);
      this.focusCurrentButton();
    }
    if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
      this.cursor = (this.cursor + 1) % MODES.length;
      this.audio.playUi(AUDIO_KEYS.ui.move);
      this.focusCurrentButton();
    }
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.routeToMode(MODES[this.cursor].key);
    }
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.returnToTitle();
    }
  }
}
