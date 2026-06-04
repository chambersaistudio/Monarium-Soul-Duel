import Phaser from 'phaser';

// ── Frame manifest ─────────────────────────────────────────────────────────────
// Key = animation name, value = array of image keys in order
const ANIM_DEFS: Array<{
  anim: string;
  frameRate: number;
  repeat: number;
  keys: string[];
}> = [
  {
    anim: 'flarepaw_idle',
    frameRate: 4,
    repeat: -1,
    keys: Array.from({ length: 5 }, (_, i) => `flarepaw_idle_${String(i + 1).padStart(2, '0')}`),
  },
  {
    anim: 'flarepaw_run',
    frameRate: 10,
    repeat: -1,
    keys: Array.from({ length: 5 }, (_, i) => `flarepaw_run_${String(i + 1).padStart(2, '0')}`),
  },
  {
    anim: 'flarepaw_jump',
    frameRate: 8,
    repeat: 0,
    keys: Array.from({ length: 5 }, (_, i) => `flarepaw_jump_${String(i + 1).padStart(2, '0')}`),
  },
];

const FRAME_BASE = 'assets/characters/flarepaw/frames';

export class PreloadScene extends Phaser.Scene {
  private loadErrors = new Set<string>();

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Loading bar
    this.add.rectangle(w / 2, h / 2, 300, 20, 0x222222);
    const bar = this.add.rectangle(w / 2 - 150, h / 2, 0, 16, 0xff6600).setOrigin(0, 0.5);
    this.add.text(w / 2, h / 2 - 40, 'MONARIUM', {
      fontSize: '32px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5);
    const statusText = this.add.text(w / 2, h / 2 + 30, 'Loading assets…', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => { bar.width = 296 * v; });
    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      statusText.setText(file.key);
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.loadErrors.add(file.key);
    });

    // Attempt to load every individual frame PNG.
    // Failures are non-fatal — we fall back to the raw sheet.
    for (const def of ANIM_DEFS) {
      for (const key of def.keys) {
        const anim  = key.replace(/flarepaw_/, '').replace(/_\d+$/, '');  // 'idle'|'run'|'jump'
        const fname = `${key}.png`;
        this.load.image(key, `${FRAME_BASE}/${anim}/${fname}`);
      }
    }

    // Also try the legacy raw sheet as a fallback
    this.load.image('flarepaw_raw', 'assets/characters/flarepaw/flarepaw_sheet.png');
  }

  create(): void {
    const allFramesReady = ANIM_DEFS.every(def =>
      def.keys.every(k => this.textures.exists(k) && !this.loadErrors.has(k))
    );

    if (allFramesReady) {
      this.registerIndividualFrameAnims();
      this.registry.set('flarepaw_sprite_key', ANIM_DEFS[0].keys[0]); // 'flarepaw_idle_01'
      this.registry.set('flarepaw_anim_mode', 'frames');
      console.log('[PreloadScene] Flarepaw individual frames loaded ✓');
    } else if (this.textures.exists('flarepaw_raw') && !this.loadErrors.has('flarepaw_raw')) {
      const ok = this.normalizeSheetFallback();
      if (ok) {
        this.registry.set('flarepaw_sprite_key', 'flarepaw');
        this.registry.set('flarepaw_anim_mode', 'sheet');
        console.log('[PreloadScene] Flarepaw sheet fallback loaded ✓');
      } else {
        this.registry.set('flarepaw_anim_mode', 'none');
      }
    } else {
      this.registry.set('flarepaw_anim_mode', 'none');
      console.warn('[PreloadScene] No Flarepaw assets found — using placeholder graphics.');
    }

    this.scene.start('TitleScene');
  }

  // ── Individual-frame animation registration ────────────────────────────────

  private registerIndividualFrameAnims(): void {
    for (const def of ANIM_DEFS) {
      if (this.anims.exists(def.anim)) this.anims.remove(def.anim);
      this.anims.create({
        key: def.anim,
        // Phaser supports multi-texture animations via frame objects with `key`
        frames: def.keys
          .filter(k => this.textures.exists(k))
          .map(k => ({ key: k })),
        frameRate: def.frameRate,
        repeat: def.repeat,
      });
    }

    // guard = first jump frame (static hold)
    const guardKey = ANIM_DEFS[2].keys[0]; // flarepaw_jump_01
    if (this.textures.exists(guardKey)) {
      if (this.anims.exists('flarepaw_guard')) this.anims.remove('flarepaw_guard');
      this.anims.create({
        key: 'flarepaw_guard',
        frames: [{ key: guardKey }],
        frameRate: 1,
        repeat: 0,
      });
    }
  }

  // ── Sheet-based fallback normalization ─────────────────────────────────────

  private normalizeSheetFallback(): boolean {
    const COLS = 5, ROWS = 4, NORM = 128;
    try {
      const src = this.textures.get('flarepaw_raw').getSourceImage() as
        HTMLImageElement | HTMLCanvasElement;
      const srcW = (src as HTMLImageElement).naturalWidth  || src.width  || 0;
      const srcH = (src as HTMLImageElement).naturalHeight || src.height || 0;
      if (!srcW || !srcH) return false;

      const fw = Math.floor(srcW / COLS);
      const fh = Math.floor(srcH / ROWS);

      const out = document.createElement('canvas');
      out.width  = NORM * COLS;
      out.height = NORM * ROWS;
      const ctx  = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const sx = col * fw, sy = row * fh;
          const { cx, cy, cw, ch } = this.detectContentBounds(src as CanvasImageSource, sx, sy, fw, fh);
          const fitSize = NORM * 0.82;
          const scale   = Math.min(fitSize / cw, fitSize / ch);
          const dw = cw * scale, dh = ch * scale;
          const dx = col * NORM + (NORM - dw) / 2;
          const dy = row * NORM + NORM - dh - NORM * 0.08;
          ctx.drawImage(src as CanvasImageSource, sx + cx, sy + cy, cw, ch, dx, dy, dw, dh);
        }
      }

      this.textures.addCanvas('flarepaw', out);
      const tex = this.textures.get('flarepaw');
      for (let i = 0; i < ROWS * COLS; i++) {
        const r = Math.floor(i / COLS), c = i % COLS;
        tex.add(i, 0, c * NORM, r * NORM, NORM, NORM);
      }

      const animDefs = [
        { key: 'flarepaw_idle',   start: 0,          end: COLS - 1,       fps: 4,  rep: -1 },
        { key: 'flarepaw_run',    start: COLS,        end: COLS * 2 - 1,   fps: 10, rep: -1 },
        { key: 'flarepaw_jump',   start: COLS * 2,    end: COLS * 3 - 1,   fps: 8,  rep: 0  },
        { key: 'flarepaw_guard',  start: COLS * 3,    end: COLS * 3,       fps: 1,  rep: 0  },
        { key: 'flarepaw_attack', start: COLS * 2,    end: COLS * 3 - 1,   fps: 18, rep: 0  },
      ];
      for (const d of animDefs) {
        if (this.anims.exists(d.key)) this.anims.remove(d.key);
        this.anims.create({
          key: d.key,
          frames: this.anims.generateFrameNumbers('flarepaw', { start: d.start, end: d.end }),
          frameRate: d.fps,
          repeat: d.rep,
        });
      }
      return true;
    } catch (e) {
      console.error('[PreloadScene] Sheet fallback failed:', e);
      return false;
    }
  }

  private detectContentBounds(
    src: CanvasImageSource, sx: number, sy: number, fw: number, fh: number
  ): { cx: number; cy: number; cw: number; ch: number } {
    const fallback = { cx: 0, cy: 0, cw: fw, ch: fh };
    try {
      const tmp = document.createElement('canvas');
      tmp.width = fw; tmp.height = fh;
      const ctx = tmp.getContext('2d')!;
      ctx.drawImage(src, sx, sy, fw, fh, 0, 0, fw, fh);
      const d = ctx.getImageData(0, 0, fw, fh).data;
      let minX = fw, minY = fh, maxX = 0, maxY = 0, found = false;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const p = (y * fw + x) * 4;
          if (d[p + 3] > 30 && !(d[p] > 230 && d[p+1] > 230 && d[p+2] > 230)) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            found = true;
          }
        }
      }
      if (!found) return fallback;
      const m = 4;
      return {
        cx: Math.max(0, minX - m),
        cy: Math.max(0, minY - m),
        cw: Math.min(fw - 1, maxX + m) - Math.max(0, minX - m),
        ch: Math.min(fh - 1, maxY + m) - Math.max(0, minY - m),
      };
    } catch { return fallback; }
  }
}
