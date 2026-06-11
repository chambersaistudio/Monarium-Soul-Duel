import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';
import { AUDIO_KEYS } from '../config/audioConfig';

// TitleScene layout strategy:
// • Phaser canvas = animated particle background only.  The particle update loop
//   reads this.scale.width/height every frame, so it always fills the viewport.
//   drawBackground() is called again on any Phaser resize event.
// • Title text, subtitle, and "tap to start" prompt live in a #title-overlay DOM
//   div that is position:fixed + CSS flexbox.  It recentres automatically on any
//   orientation change — no Phaser coordinate dependency.
// • ENTER key and a DOM pointerdown listener both trigger the scene transition.
// • The DOM overlay is removed on scene shutdown so it cannot leak into other scenes.

interface Particle {
  x: number; y: number; vx: number; vy: number;
  r: number; color: number; alpha: number;
}

export class TitleScene extends Phaser.Scene {
  private particles:   Particle[] = [];
  private bgGfx!:      Phaser.GameObjects.Graphics;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private enterKey!:   Phaser.Input.Keyboard.Key;
  private audio!:      AudioManager;

  private titleOverlay: HTMLDivElement | null = null;
  private blinkTimer:   ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor() { super({ key: 'TitleScene' }); }

  create(): void {
    const { width: w, height: h } = this.scale;
    this.started = false;

    this.bgGfx       = this.add.graphics().setDepth(0);
    this.particleGfx = this.add.graphics().setDepth(1);
    this.drawBackground();

    for (let i = 0; i < 30; i++) {
      this.particles.push({
        x:     Math.random() * w,
        y:     Math.random() * h,
        vx:    (Math.random() - 0.5) * 20,
        vy:   -(Math.random() * 15 + 5),
        r:     Math.random() * 2 + 1,
        color: [0xff6600, 0xff4400, 0xffaa00, 0xcc88ff][Math.floor(Math.random() * 4)],
        alpha: Math.random() * 0.6 + 0.2,
      });
    }

    this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.audio = new AudioManager(this);
    this.audio.playBgm(AUDIO_KEYS.bgm.menu);

    this.createTitleOverlay();

    this.scale.on('resize', this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  // ── DOM overlay ─────────────────────────────────────────────────────────────

  private createTitleOverlay(): void {
    this.removeTitleOverlay();

    const div = document.createElement('div');
    div.id = 'title-overlay';
    div.style.cssText = [
      'position:fixed', 'inset:0',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center',
      'gap:16px', 'font-family:monospace',
      'z-index:100', 'pointer-events:auto',
      'transition:opacity 0.4s ease',
      'user-select:none', '-webkit-user-select:none',
    ].join(';');

    div.innerHTML = `
      <div style="font-size:clamp(38px,10vw,72px);font-weight:bold;color:#ff6600;
                  letter-spacing:4px;text-align:center;
                  text-shadow:0 0 30px #ff3300,0 0 60px #ff330044;">MONARIUM</div>
      <div style="font-size:clamp(13px,3.5vw,26px);color:#ffaa44;font-weight:bold;
                  letter-spacing:10px;text-align:center;">SOUL DUEL</div>
      <div style="font-size:clamp(9px,2vw,14px);color:#666666;
                  letter-spacing:6px;text-align:center;">PROTOTYPE</div>
      <div style="width:min(280px,55vw);height:1px;background:#ff6600;
                  opacity:0.35;margin:4px 0;"></div>
      <div id="title-start-prompt"
           style="font-size:clamp(13px,3.5vw,20px);color:#ffffff;letter-spacing:2px;
                  padding:12px 28px;border:1px solid #ffffff33;border-radius:4px;
                  cursor:pointer;text-align:center;
                  -webkit-tap-highlight-color:transparent;">
        TAP / ENTER TO START
      </div>
      <div style="position:absolute;
                  bottom:max(14px,env(safe-area-inset-bottom,14px));
                  font-size:9px;color:#333344;letter-spacing:1px;
                  text-align:center;padding:0 16px;pointer-events:none;">
        ARROWS=MOVE &nbsp; J=ATTACK &nbsp; K=SPECIAL &nbsp; L=DODGE &nbsp; I=ABILITY
      </div>
    `;

    document.body.appendChild(div);
    this.titleOverlay = div;

    // Blink the "tap to start" prompt
    const prompt = div.querySelector<HTMLElement>('#title-start-prompt');
    if (prompt) {
      let vis = true;
      this.blinkTimer = setInterval(() => {
        if (prompt) prompt.style.opacity = vis ? '1' : '0.25';
        vis = !vis;
      }, 600);
    }

    // Pointer tap anywhere on overlay starts the game
    div.addEventListener('pointerdown', () => this.doStart(), { once: true, passive: true });
  }

  private removeTitleOverlay(): void {
    if (this.blinkTimer !== null) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
    this.titleOverlay?.remove();
    this.titleOverlay = null;
    document.getElementById('title-overlay')?.remove();
  }

  private doStart(): void {
    if (this.started) return;
    this.started = true;
    if (this.titleOverlay) {
      this.titleOverlay.style.opacity       = '0';
      this.titleOverlay.style.pointerEvents = 'none';
    }
    this.cameras.main.fade(400, 0, 0, 0, false, (_: unknown, p: number) => {
      if (p === 1) this.scene.start('ModeSelectScene');
    });
  }

  // ── Phaser lifecycle ─────────────────────────────────────────────────────────

  private onResize(): void {
    this.drawBackground();
  }

  private onShutdown(): void {
    this.scale.off('resize', this.onResize, this);
    this.removeTitleOverlay();
  }

  private drawBackground(): void {
    const { width: w, height: h } = this.scale;
    const g = this.bgGfx;
    g.clear();
    for (let i = 0; i < h; i += 4) {
      const t  = i / h;
      const r  = Math.floor(Phaser.Math.Linear(8,  20, t));
      const gv = Math.floor(Phaser.Math.Linear(4,  8,  t));
      const b  = Math.floor(Phaser.Math.Linear(18, 6,  t));
      g.fillStyle(Phaser.Display.Color.GetColor(r, gv, b), 1);
      g.fillRect(0, i, w, 4);
    }
    g.fillStyle(0xff4400, 0.05);
    g.fillCircle(w / 2, h / 2 - 80, 200);
  }

  update(_time: number, delta: number): void {
    const { width: w, height: h } = this.scale;

    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.doStart();
    }

    this.particleGfx.clear();
    for (const p of this.particles) {
      p.x += p.vx * delta / 1000;
      p.y += p.vy * delta / 1000;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      this.particleGfx.fillStyle(p.color, p.alpha);
      this.particleGfx.fillCircle(p.x, p.y, p.r);
    }
  }
}
