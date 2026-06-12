import Phaser from 'phaser';

/**
 * Plays the Monarium opening cinematic while PreloadScene loads assets in parallel.
 *
 * Flow:
 *   BootScene → SplashScene (launches PreloadScene in background + plays video)
 *              ↓ video ends or skipped
 *   SplashScene stops itself → PreloadScene loading bar visible if still running
 *              ↓ PreloadScene finishes (stops SplashScene if still active, starts TitleScene)
 *   TitleScene
 *
 * Missing video file → silently skipped; PreloadScene's loading bar becomes the
 * only visible UI until assets are ready.
 */
export class SplashScene extends Phaser.Scene {
  private videoEl: HTMLVideoElement | null = null;
  private skipFn:  (() => void) | null = null;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'SplashScene' }); }

  create(): void {
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    // Start asset loading immediately in the background.
    this.scene.launch('PreloadScene');

    // Play opening on top of the loading screen.
    this.playOpening();
  }

  private playOpening(): void {
    const video = document.createElement('video');
    video.src = 'assets/startup/opening/monarium_opening.mp4';
    video.playsInline = true;
    video.muted = false;
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;background:#000;z-index:9000;';

    const done = () => {
      this.skipFn = null;
      if (this.videoEl === video) {
        video.remove();
        this.videoEl = null;
      }
      this.proceed();
    };

    video.addEventListener('ended',  done, { once: true });
    video.addEventListener('error',  done, { once: true });  // missing file → skip
    video.addEventListener('pointerdown', done, { once: true });
    this.skipFn = done;

    document.body.appendChild(video);
    this.videoEl = video;

    video.play().catch(done);  // autoplay blocked → skip
  }

  private proceed(): void {
    // PreloadScene is running in background.
    // Just stop this scene — PreloadScene will call scene.start('TitleScene') when ready.
    // If PreloadScene already finished while we were playing, it already stopped us
    // via its own shutdown logic; this call is a no-op in that case.
    this.scene.stop();
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
