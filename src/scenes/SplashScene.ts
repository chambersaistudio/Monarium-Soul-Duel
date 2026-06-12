import Phaser from 'phaser';

/**
 * Plays pre-gameplay video sequences before PreloadScene runs:
 *   1. Chambers Studios splash  (muted, not skippable)
 *   2. Monarium opening cinematic  (unmuted, skippable by tap or Enter)
 *
 * Missing video files are silently skipped — the game never breaks if
 * the assets folder is empty.
 */
export class SplashScene extends Phaser.Scene {
  private videoEl: HTMLVideoElement | null = null;
  private skipFn:  (() => void) | null = null;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'SplashScene' }); }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.playSplash();
  }

  private playSplash(): void {
    this.playVideo(
      'assets/startup/splash/chambers_studios_splash.mp4',
      false,
      () => this.playOpening(),
    );
  }

  private playOpening(): void {
    this.playVideo(
      'assets/startup/opening/monarium_opening.mp4',
      true,
      () => this.proceed(),
    );
  }

  private playVideo(src: string, skippable: boolean, onEnd: () => void): void {
    this.cleanup();

    const video = document.createElement('video');
    video.src = src;
    video.playsInline = true;
    video.muted = !skippable;
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:9000;';

    const done = () => {
      this.skipFn = null;
      if (this.videoEl === video) {
        video.remove();
        this.videoEl = null;
      }
      onEnd();
    };

    video.addEventListener('ended', done, { once: true });
    video.addEventListener('error', done, { once: true });

    if (skippable) {
      this.skipFn = done;
      video.addEventListener('pointerdown', done, { once: true });
    }

    document.body.appendChild(video);
    this.videoEl = video;

    video.play().catch(done);
  }

  private proceed(): void {
    this.scene.start('PreloadScene');
  }

  private cleanup(): void {
    this.skipFn = null;
    this.videoEl?.remove();
    this.videoEl = null;
  }

  update(): void {
    if (this.skipFn && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      const fn = this.skipFn;
      this.skipFn = null;
      this.videoEl?.remove();
      this.videoEl = null;
      fn();
    }
  }
}
