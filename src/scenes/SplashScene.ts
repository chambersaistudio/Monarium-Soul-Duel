import Phaser from 'phaser';

/**
 * Plays the Monarium opening cinematic while PreloadScene loads assets in parallel.
 *
 * Skip rules:
 *   - Video always plays to completion unless the user taps / presses Enter.
 *   - Tapping or pressing Enter only skips if preload_complete is already true.
 *     (user must watch the opening if assets are still loading)
 *   - When the video ends naturally, always proceed to TitleScene regardless
 *     of load state (TitleScene handles the "still loading" case).
 *   - Missing / unplayable file → immediately proceeds to TitleScene.
 */
export class SplashScene extends Phaser.Scene {
  private videoEl: HTMLVideoElement | null = null;
  private proceedFn: (() => void) | null = null;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'SplashScene' }); }

  create(): void {
    this.registry.set('preload_complete', false);
    this.registry.set('preload_progress', 0);

    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    // Start asset loading in the background immediately.
    this.scene.launch('PreloadScene');

    this.playOpening();
  }

  private playOpening(): void {
    const video = document.createElement('video');
    // Note: file on disk is monarium_opening.MP4 (uppercase extension)
    video.src = 'assets/startup/opening/monarium_opening.MP4';
    video.playsInline = true;
    video.muted = false;
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:9000;';

    const done = () => {
      this.proceedFn = null;
      if (this.videoEl === video) {
        video.remove();
        this.videoEl = null;
      }
      this.proceed();
    };

    // Always proceed when video ends naturally.
    video.addEventListener('ended', done, { once: true });
    // Missing file or codec error → skip immediately.
    video.addEventListener('error', done, { once: true });

    // Tap to skip — only allowed once assets are loaded.
    const trySkip = () => {
      if (this.registry.get('preload_complete') && this.videoEl === video) {
        done();
      }
    };
    video.addEventListener('pointerdown', trySkip);
    this.proceedFn = done;

    document.body.appendChild(video);
    this.videoEl = video;

    video.play().catch(done);
  }

  private proceed(): void {
    this.cleanup();
    this.scene.start('TitleScene');
  }

  private cleanup(): void {
    this.proceedFn = null;
    this.videoEl?.remove();
    this.videoEl = null;
  }

  update(): void {
    if (
      this.proceedFn &&
      this.registry.get('preload_complete') &&
      Phaser.Input.Keyboard.JustDown(this.enterKey)
    ) {
      const fn = this.proceedFn;
      this.proceedFn = null;
      this.videoEl?.remove();
      this.videoEl = null;
      fn();
    }
  }
}
