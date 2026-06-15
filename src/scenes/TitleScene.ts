import Phaser from 'phaser';
import { hideBootOverlay, layoutDomOverlays, showStartOverlay } from '../ui/bootOverlay';
import { stopGameplayScenes } from '../utils/sceneHygiene';

/**
 * Title scene — the user's first tap gesture unlocks audio for all subsequent
 * video playback (iOS / Android block unmuted autoplay before interaction).
 *
 * Flow after user taps "Start":
 *   1. hideBootOverlay() — dismiss loading/start screen
 *   2. Play monarium_opening.MP4 full-screen (unmuted — audio works now)
 *      └ tap anywhere or press Enter to skip
 *   3. Play title_screen_loop.mp4 full-screen (unmuted, looping)
 *      └ tap anywhere or press Enter → ModeSelectScene
 */
export class TitleScene extends Phaser.Scene {
  private videoEl:  HTMLVideoElement | null = null;
  private enterKey!: Phaser.Input.Keyboard.Key;
  private phase: 'start' | 'opening' | 'title' = 'start';

  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    stopGameplayScenes(this);
    this.sound.stopAll();
    this.phase = 'start';
    this.videoEl = null;

    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    layoutDomOverlays();

    // Show the boot-overlay "Start" button — this tap IS the user gesture that
    // unlocks audio on mobile browsers.
    showStartOverlay(() => this.onUserStart());

    // Canvas tap is an additional fallback (triggers same path).
    this.input.once('pointerup', () => this.onUserStart());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupVideo());
  }

  // ── Stage 1: user taps "Start" ───────────────────────────────────────────────

  private onUserStart(): void {
    if (this.phase !== 'start') return;
    this.phase = 'opening';
    hideBootOverlay();
    this.playOpening();
  }

  // ── Stage 2: opening cinematic ────────────────────────────────────────────────

  private playOpening(): void {
    this.cleanupVideo();
    const video = document.createElement('video');
    video.src = 'assets/startup/opening/monarium_opening.MP4';
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.muted = false;   // audio is now allowed — user just tapped
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;' +
      'background:#000;z-index:10000;';

    const done = () => {
      this.cleanupVideo();
      this.playTitle();
    };

    video.addEventListener('ended', done, { once: true });
    // Codec/network error → skip to title
    video.addEventListener('error', done, { once: true });
    // Tap anywhere to skip opening
    video.addEventListener('pointerdown', done, { once: true });

    document.body.appendChild(video);
    this.videoEl = video;

    const promise = video.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // play() rejected — try muted as last resort, then move on
        video.muted = true;
        const retry = video.play();
        if (retry !== undefined) retry.catch(done);
      });
    }
  }

  // ── Stage 3: title video (loop until tap) ────────────────────────────────────

  private playTitle(): void {
    if (this.phase === 'start') return;  // scene already shutting down
    this.phase = 'title';
    this.cleanupVideo();

    const video = document.createElement('video');
    video.src = 'assets/startup/title/title_screen_loop.mp4';
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.muted = false;
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;' +
      'background:#000;z-index:10000;';

    video.addEventListener('error', () => {
      // File missing — show Phaser fallback so screen isn't blank
      video.remove();
      if (this.videoEl === video) this.videoEl = null;
      this.showPhaserFallback();
    }, { once: true });

    video.addEventListener('pointerdown', () => this.startGame(), { once: true });

    document.body.appendChild(video);
    this.videoEl = video;

    const promise = video.play();
    if (promise !== undefined) {
      promise.catch(() => {
        video.muted = true;
        const retry = video.play();
        if (retry !== undefined) retry.catch(() => {});
      });
    }
  }

  // ── Phaser fallback (when title video file is missing) ──────────────────────

  private showPhaserFallback(): void {
    const cx = this.scale.width  / 2;
    const cy = this.scale.height / 2;
    const titleSize = Math.floor(Math.min(64, this.scale.width / 9));
    this.add.text(cx, cy - 50, 'MONARIUM', {
      fontSize: `${titleSize}px`, color: '#ff6600', fontStyle: 'bold',
      fontFamily: 'Orbitron, monospace', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2);
    this.add.text(cx, cy + 4, 'SOUL DUEL', {
      fontSize: '22px', color: '#ffaa44',
      fontFamily: 'Orbitron, monospace', letterSpacing: 10,
    }).setOrigin(0.5).setDepth(2);
    const prompt = this.add.text(cx, cy + 68, 'Tap to Start', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2);
    this.tweens.add({ targets: prompt, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    this.input.once('pointerup', () => this.startGame());
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  private startGame(): void {
    if (this.phase !== 'title') return;
    this.cleanupVideo();
    this.scene.start('ModeSelectScene');
  }

  private cleanupVideo(): void {
    this.videoEl?.remove();
    this.videoEl = null;
  }

  update(): void {
    if (this.phase === 'opening' && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.cleanupVideo();
      this.playTitle();
    }
    if (this.phase === 'title' && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.startGame();
    }
  }
}
