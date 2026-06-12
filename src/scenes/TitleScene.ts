import Phaser from 'phaser';
import { layoutDomOverlays } from '../ui/bootOverlay';

/**
 * Title screen — plays title_screen_loop.mp4 full-screen (muted, z-index 10000).
 *
 * z-index stack:
 *   boot-overlay    9 999  (fades out when PreloadScene finishes)
 *   title video    10 000  (above boot overlay — user sees video, not loading bar)
 *   load overlay   10 001  (own minimal progress bar shown on top of video)
 *
 * Interaction:
 *   - While preload_complete is false: tap / Enter does nothing.
 *   - Once preload_complete fires: load bar fades, tap / Enter → ModeSelectScene.
 *   - The video's last frame has a built-in "tap to start" — no DOM button needed.
 *   - Phaser canvas fallback (text + canvas tap) activates if the video fails.
 */
export class TitleScene extends Phaser.Scene {
  private titleVideo:  HTMLVideoElement | null = null;
  private loadOverlay: HTMLDivElement  | null = null;
  private promptText:  Phaser.GameObjects.Text | null = null;
  private ready    = false;
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

    // Phaser canvas always handles tap as a fallback (works even when video is invisible)
    this.input.on('pointerup', () => { if (this.ready) this.startGame(); });

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
    video.muted = true;         // muted = reliable autoplay; audio can be re-enabled later
    video.setAttribute('playsinline', '');
    video.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;' +
      'z-index:10000;';

    // If the file doesn't exist / codec fails, show the Phaser fallback.
    video.addEventListener('error', () => {
      video.remove();
      if (this.titleVideo === video) this.titleVideo = null;
      this.showPhaserFallback();
    }, { once: true });

    // Tap on video → start game (only when ready)
    video.addEventListener('pointerdown', () => { if (this.ready) this.startGame(); });

    document.body.appendChild(video);
    this.titleVideo = video;

    const promise = video.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // play() blocked but video element is still in DOM.
        // First frame renders; user can still tap when ready.
      });
    }
  }

  // ── Loading overlay (shown while assets are still loading) ──────────────────

  private createLoadOverlay(): void {
    const el = document.createElement('div');
    el.id = 'title-load-overlay';
    el.style.cssText = [
      'position:fixed;inset:0;',
      'z-index:10001;',    // above the title video (10000)
      'display:flex;flex-direction:column;align-items:center;justify-content:flex-end;',
      'padding-bottom:max(52px,env(safe-area-inset-bottom,52px));',
      'pointer-events:none;',
    ].join('');
    el.innerHTML = `
      <div style="width:min(260px,68vw)">
        <div style="height:3px;background:rgba(255,255,255,0.12);border-radius:2px;overflow:hidden">
          <div id="title-load-bar"
               style="height:100%;width:0%;background:#ff6600;
                      transition:width 120ms linear;border-radius:2px;">
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    this.loadOverlay = el;
  }

  private onLoadReady(): void {
    if (this.loadOverlay) {
      this.loadOverlay.style.transition = 'opacity 0.35s';
      this.loadOverlay.style.opacity    = '0';
      setTimeout(() => {
        this.loadOverlay?.remove();
        this.loadOverlay = null;
      }, 380);
    }
    // If promptText is showing (Phaser fallback), make it pulsing/visible
    if (this.promptText) {
      this.promptText.setAlpha(1);
      this.tweens.add({ targets: this.promptText, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
    }
    this.ready = true;
  }

  // ── Phaser fallback (used when video fails to load) ──────────────────────────

  private showPhaserFallback(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.add.text(cx, cy - 50, 'MONARIUM', {
      fontSize: String(Math.floor(Math.min(64, this.scale.width / 9))) + 'px',
      color: '#ff6600', fontStyle: 'bold',
      fontFamily: 'Orbitron, monospace',
      stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2);
    this.add.text(cx, cy + 4, 'SOUL DUEL', {
      fontSize: '22px', color: '#ffaa44',
      fontFamily: 'Orbitron, monospace', letterSpacing: 10,
    }).setOrigin(0.5).setDepth(2);
    this.promptText = this.add.text(cx, cy + 68, 'Tap to Start', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2).setAlpha(0);
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
    // Keep progress bar in sync with PreloadScene's load progress.
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
