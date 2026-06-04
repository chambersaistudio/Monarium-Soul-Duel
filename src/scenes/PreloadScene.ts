import Phaser from 'phaser';

const COLS = 5;
const ROWS = 4;
const NORM_SIZE = 128; // output px per frame (square)

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Loading bar UI
    this.add.rectangle(w / 2, h / 2, 300, 20, 0x222222);
    const bar = this.add.rectangle(w / 2 - 150, h / 2, 0, 16, 0xff6600).setOrigin(0, 0.5);
    this.add.text(w / 2, h / 2 - 40, 'MONARIUM', {
      fontSize: '32px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace'
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => { bar.width = 296 * v; });

    // Try to load Flarepaw sprite sheet — failure is non-fatal
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn(`[PreloadScene] Could not load ${file.key} — using placeholder graphics.`);
    });

    this.load.image('flarepaw_raw', 'assets/characters/flarepaw/flarepaw_sheet.png');
  }

  create(): void {
    if (this.textures.exists('flarepaw_raw')) {
      this.normalizeFlarepaw();
    }
    this.scene.start('TitleScene');
  }

  // ── Sprite normalizer ───────────────────────────────────────────────────────
  // Takes the raw sheet, slices COLS×ROWS frames, scales each to NORM_SIZE×NORM_SIZE
  // preserving aspect ratio, and registers the result as texture 'flarepaw'
  // with numeric frame indices (row * COLS + col).
  private normalizeFlarepaw(): void {
    const src = this.textures.get('flarepaw_raw').getSourceImage() as
      HTMLImageElement | HTMLCanvasElement;

    const srcW = (src as HTMLImageElement).naturalWidth  || src.width  || 0;
    const srcH = (src as HTMLImageElement).naturalHeight || src.height || 0;

    if (!srcW || !srcH) {
      console.warn('[PreloadScene] flarepaw_raw has zero dimensions — skipping normalization.');
      return;
    }

    const frameW = Math.floor(srcW / COLS);
    const frameH = Math.floor(srcH / ROWS);

    const outCanvas = document.createElement('canvas');
    outCanvas.width  = NORM_SIZE * COLS;
    outCanvas.height = NORM_SIZE * ROWS;
    const ctx = outCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const sx = col * frameW;
        const sy = row * frameH;

        // Find content bounding box within this frame to help centering
        const { cx, cy, cw, ch } = this.contentBounds(
          src as CanvasImageSource, sx, sy, frameW, frameH
        );

        // Scale to fit NORM_SIZE with padding, preserving aspect ratio
        const padding = 0.1; // 10% padding on each side
        const fitSize = NORM_SIZE * (1 - padding * 2);
        const scale   = Math.min(fitSize / cw, fitSize / ch);
        const dw = cw * scale;
        const dh = ch * scale;

        // Center horizontally, align baseline to bottom of norm frame
        const dx = col * NORM_SIZE + (NORM_SIZE - dw) / 2;
        // Align bottom of content to bottom of the padded area
        const dy = row * NORM_SIZE + (NORM_SIZE - dh) - NORM_SIZE * padding;

        ctx.drawImage(src as CanvasImageSource, sx + cx, sy + cy, cw, ch, dx, dy, dw, dh);
      }
    }

    this.textures.addCanvas('flarepaw', outCanvas);

    // Register numeric frame indices
    const tex = this.textures.get('flarepaw');
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        tex.add(idx, 0, col * NORM_SIZE, row * NORM_SIZE, NORM_SIZE, NORM_SIZE);
      }
    }

    // Register animations
    this.anims.create({
      key: 'flarepaw_idle',
      frames: this.anims.generateFrameNumbers('flarepaw', { start: 0, end: COLS - 1 }),
      frameRate: 7,
      repeat: -1
    });

    this.anims.create({
      key: 'flarepaw_run',
      frames: this.anims.generateFrameNumbers('flarepaw', { start: COLS, end: COLS * 2 - 1 }),
      frameRate: 12,
      repeat: -1
    });

    // Guard/special pose — use first frame of row 3 (index COLS*3)
    this.anims.create({
      key: 'flarepaw_guard',
      frames: this.anims.generateFrameNumbers('flarepaw', { start: COLS * 3, end: COLS * 3 }),
      frameRate: 1,
      repeat: 0
    });

    // Attack — use row 2 frames (jump/attack row) for now
    this.anims.create({
      key: 'flarepaw_attack',
      frames: this.anims.generateFrameNumbers('flarepaw', { start: COLS * 2, end: COLS * 3 - 1 }),
      frameRate: 18,
      repeat: 0
    });

    console.log('[PreloadScene] Flarepaw sprite normalized and registered.');
  }

  // Returns the tight content bounding box of a frame (skips near-transparent or near-white pixels).
  // Falls back to full frame if canvas API fails.
  private contentBounds(
    src: CanvasImageSource,
    sx: number, sy: number, fw: number, fh: number
  ): { cx: number; cy: number; cw: number; ch: number } {
    const fallback = { cx: 0, cy: 0, cw: fw, ch: fh };
    try {
      const tmp = document.createElement('canvas');
      tmp.width = fw; tmp.height = fh;
      const ctx = tmp.getContext('2d')!;
      ctx.drawImage(src, sx, sy, fw, fh, 0, 0, fw, fh);
      const imageData = ctx.getImageData(0, 0, fw, fh);
      const d = imageData.data;

      let minX = fw, minY = fh, maxX = 0, maxY = 0;
      let found = false;

      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const idx = (y * fw + x) * 4;
          const r = d[idx], g = d[idx + 1], b = d[idx + 2], a = d[idx + 3];
          // Pixel counts as content if: not nearly transparent AND not nearly white
          const isContent = a > 30 && !(r > 230 && g > 230 && b > 230);
          if (isContent) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }

      if (!found) return fallback;

      // Small margin around detected bounds
      const margin = 4;
      minX = Math.max(0, minX - margin);
      minY = Math.max(0, minY - margin);
      maxX = Math.min(fw - 1, maxX + margin);
      maxY = Math.min(fh - 1, maxY + margin);

      return { cx: minX, cy: minY, cw: maxX - minX, ch: maxY - minY };
    } catch {
      return fallback;
    }
  }
}
