import Phaser from 'phaser';

/**
 * Plays monarium_opening.MP4 while PreloadScene loads assets in the background.
 *
 * The opening video is muted so it autoplays reliably before any user gesture
 * (iOS/Android block unmuted autoplay).  z-index 10000 puts it above the boot
 * overlay (9999) so the loading bar is hidden while the cinematic plays.
 *
 * Skip rules:
 *   - Tap or Enter skips only when preload_complete is already true.
 *   - The video always plays to completion if still loading.
 *   - Missing file / play error → proceed to TitleScene immediately.
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
    video.src = 'assets/startup/opening/monarium_opening.MP4';
    video.playsInline = true;
    video.muted = true;          // muted = guaranteed autoplay before user gesture
    video.setAttribute('playsinline', '');  // belt-and-braces for iOS WKWebView
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;' +
      'background:#000;z-index:10000;';  // above boot-overlay (9999)

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
    // Missing file / codec error → skip.
    video.addEventListener('error', done, { once: true });

    // Tap anywhere on video to skip — only when loaded.
    const trySkip = () => {
      if (this.registry.get('preload_complete') && this.videoEl === video) done();
    };
    video.addEventListener('pointerdown', trySkip);
    this.proceedFn = done;

    document.body.appendChild(video);
    this.videoEl = video;

    const promise = video.play();
    if (promise !== undefined) promise.catch(done);
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
