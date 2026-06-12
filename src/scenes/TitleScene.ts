import Phaser from 'phaser';
import { layoutDomOverlays } from '../ui/bootOverlay';

/**
 * Title screen — plays title_screen_loop.mp4 full-screen.
 *
 * Loading bar overlay sits on top of the video if assets are still loading
 * (possible when the opening is skipped early or the file was missing).
 * Once preload_complete fires, the bar fades out and the screen becomes
 * tappable — the video's last frame has a built-in "tap to start" image.
 *
 * Tap anywhere / press Enter → ModeSelectScene.
 */
export class TitleScene extends Phaser.Scene {
  private titleVideo: HTMLVideoElement | null = null;
  private loadOverlay: HTMLDivElement  | null = null;
  private ready = false;
  private starting = false;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    this.ready    = false;
    this.starting = false;
    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    layoutDomOverlays();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-preload_complete', undefined, this);
      this.titleVideo?.remove();
      this.titleVideo = null;
      this.loadOverlay?.remove();
      this.loadOverlay = null;
    });

    this.createTitleVideo();

    if (this.registry.get('preload_complete')) {
      this.onLoadReady();
    } else {
      this.createLoadOverlay();
      this.registry.events.on(
        'changedata-preload_complete',
        (_parent: unknown, value: boolean) => { if (value) this.onLoadReady(); },
        this,
      );
    }
  }

  // ── Title video ─────────────────────────────────────────────────────────────

  private createTitleVideo(): void {
    const video = document.createElement('video');
    video.src = 'assets/startup/title/title_screen_loop.mp4';
    video.loop = true;
    video.playsInline = true;
    video.muted = false;
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:9000;';

    video.addEventListener('error', () => {
      video.remove();
      if (this.titleVideo === video) this.titleVideo = null;
    }, { once: true });

    video.addEventListener('pointerdown', () => {
      if (this.ready) this.startGame();
    });

    document.body.appendChild(video);
    this.titleVideo = video;

    video.play().catch(() => {
      // Autoplay blocked — retry muted (browser policy on first load)
      video.muted = true;
      video.play().catch(() => {
        video.remove();
        if (this.titleVideo === video) this.titleVideo = null;
      });
    });
  }

  // ── Loading overlay ──────────────────────────────────────────────────────────

  private createLoadOverlay(): void {
    const el = document.createElement('div');
    el.id = 'title-load-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;z-index:9001;',
      'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;',
      'padding-bottom:max(48px,env(safe-area-inset-bottom,48px));',
      'pointer-events:none;',
    ].join('');
    el.innerHTML = `
      <div style="width:min(280px,72vw)">
        <div style="height:3px;background:#1a1a22;border-radius:2px;overflow:hidden">
          <div id="title-load-bar"
               style="height:100%;width:0%;background:#ff6600;transition:width 120ms linear;">
          </div>
        </div>
        <div id="title-load-label"
             style="margin-top:6px;font-family:monospace;font-size:10px;color:#555;text-align:center;letter-spacing:2px;">
          LOADING
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this.loadOverlay = el;
  }

  private onLoadReady(): void {
    if (this.loadOverlay) {
      this.loadOverlay.style.transition = 'opacity 0.4s';
      this.loadOverlay.style.opacity    = '0';
      setTimeout(() => {
        this.loadOverlay?.remove();
        this.loadOverlay = null;
      }, 420);
    }
    this.ready = true;
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  private startGame(): void {
    if (!this.ready || this.starting) return;
    this.starting = true;
    this.titleVideo?.remove();
    this.titleVideo = null;
    this.loadOverlay?.remove();
    this.loadOverlay = null;
    this.scene.start('ModeSelectScene');
  }

  update(): void {
    // Update loading bar progress from registry (written by PreloadScene each frame)
    if (this.loadOverlay) {
      const pct = Math.round((this.registry.get('preload_progress') as number ?? 0) * 100);
      const bar = document.getElementById('title-load-bar');
      if (bar) bar.style.width = `${pct}%`;
    }

    if (this.ready && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.startGame();
    }
  }
}
