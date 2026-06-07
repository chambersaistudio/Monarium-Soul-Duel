import Phaser from 'phaser';
import { FLAREPAW_BASE, FLAREPAW_FRAMES } from '../generated/flarepaw-manifest';

const NORM_SIZE = 512;
const NORM_BASE = 40;  // px of transparent space below feet in normalised canvas

// Maps animation folder → Phaser animation config.
// jump folder (if present) is handled separately — split into 3 phase-animations.
const ANIM_CONFIG: Record<string, { animKey: string; frameRate: number; repeat: number }> = {
  idle:        { animKey: 'flarepaw_idle',       frameRate: 8,  repeat: -1 },
  run:         { animKey: 'flarepaw_run',         frameRate: 12, repeat: -1 },
  attack:      { animKey: 'flarepaw_attack',      frameRate: 12, repeat: 0  },
  hurt:        { animKey: 'flarepaw_hurt',        frameRate: 12, repeat: 0  },
  guard:       { animKey: 'flarepaw_guard',       frameRate: 8,  repeat: -1 },
  flame_guard: { animKey: 'flarepaw_flame_guard', frameRate: 12, repeat: -1 },
};

type ManifestJSON = { character?: string; generated?: string; animations?: Record<string, string[]> };

function phaserKey(folder: string, stem: string): string {
  return `fp_${folder}_${stem}`;
}

function normKey(rawKey: string): string {
  return 'fpn' + rawKey.slice(2);
}

export class PreloadScene extends Phaser.Scene {
  private loadErrors = new Set<string>();

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, 300, 20, 0x222222);
    const bar = this.add.rectangle(w / 2 - 150, h / 2, 0, 16, 0xff6600).setOrigin(0, 0.5);
    this.add.text(w / 2, h / 2 - 40, 'MONARIUM', {
      fontSize: '32px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5);
    const statusText = this.add.text(w / 2, h / 2 + 30, 'Loading assets…', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress',     (v: number) => { bar.width = 296 * v; });
    this.load.on('fileprogress', (f: Phaser.Loader.File) => { statusText.setText(f.key); });
    this.load.on('loaderror',    (f: Phaser.Loader.File) => { this.loadErrors.add(f.key); });

    // Load runtime JSON manifest first.  When it completes, queue any frames it
    // lists that aren't already in the compile-time manifest (handles newly added
    // frames before a rebuild).  Missing files still fire loaderror and get skipped.
    this.load.json('flarepaw_manifest', `${FLAREPAW_BASE}/sprite-manifest.json`);
    this.load.on('filecomplete-json-flarepaw_manifest', () => {
      const json = this.cache.json.get('flarepaw_manifest') as ManifestJSON | null;
      if (!json?.animations) return;
      for (const [folder, stems] of Object.entries(json.animations)) {
        for (const stem of stems) {
          const key = phaserKey(folder, stem);
          if (!this.textures.exists(key)) {
            this.load.image(key, `${FLAREPAW_BASE}/${folder}/${stem}.png`);
          }
        }
      }
    });

    // Queue all compile-time manifest frames as the primary load set.
    // The JSON manifest overrides the source-of-truth in create(), but we seed
    // here so frames load even if sprite-manifest.json is absent or stale.
    for (const [folder, stems] of Object.entries(FLAREPAW_FRAMES)) {
      for (const stem of stems) {
        this.load.image(phaserKey(folder, stem), `${FLAREPAW_BASE}/${folder}/${stem}.png`);
      }
    }
  }

  create(): void {
    // JSON manifest (written by npm run gen:manifest) reflects actual files on disk.
    // Prefer it over the compile-time TypeScript manifest so deleted frames are not
    // attempted, and newly added frames (added since last build) are picked up.
    const jsonOk = !this.loadErrors.has('flarepaw_manifest') && this.cache.json.has('flarepaw_manifest');
    const sourceFrames: Record<string, readonly string[]> =
      jsonOk
        ? ((this.cache.json.get('flarepaw_manifest') as ManifestJSON).animations ?? FLAREPAW_FRAMES)
        : FLAREPAW_FRAMES;

    if (jsonOk) {
      console.log('[PreloadScene] Using runtime sprite-manifest.json');
    } else {
      console.log('[PreloadScene] sprite-manifest.json not found — using compile-time manifest');
    }

    const loaded = (k: string) => this.textures.exists(k) && !this.loadErrors.has(k);

    // Build per-folder frame lists from ONLY the frames that actually loaded.
    // This makes the system self-healing: if a frame was deleted but the manifest
    // wasn't regenerated, it simply gets skipped instead of breaking the animation.
    const loadedFolders: Record<string, string[]> = {};
    for (const [folder, stems] of Object.entries(sourceFrames)) {
      const ok      = (stems as string[]).filter(s => loaded(phaserKey(folder, s)));
      const skipped = (stems as string[]).filter(s => !loaded(phaserKey(folder, s)));

      if (skipped.length > 0) {
        console.warn(`[PreloadScene] ${folder}: skipped ${skipped.length} missing frame(s): ${skipped.join(', ')}`);
        console.warn(`[PreloadScene] → Run "npm run gen:manifest" to update the manifest`);
      }
      if (ok.length > 0) {
        loadedFolders[folder] = ok;
        console.log(`[PreloadScene] ${folder} (${ok.length}f): [${ok.join(', ')}]`);
      }
    }

    if (loadedFolders['idle'] || loadedFolders['run']) {
      const firstKey = this.normalizeAndRegister(loadedFolders);
      this.registry.set('flarepaw_sprite_key',         firstKey);
      this.registry.set('flarepaw_anim_mode',          'frames');
      this.registry.set('flarepaw_guard_loaded',       !!loadedFolders['guard']);
      this.registry.set('flarepaw_flame_guard_loaded', !!loadedFolders['flame_guard']);
      this.registry.set('flarepaw_attack_loaded',      !!loadedFolders['attack']);
      this.registry.set('flarepaw_hurt_loaded',        !!loadedFolders['hurt']);
      this.registry.set('flarepaw_jump_loaded',        !!loadedFolders['jump']);

      const summary = Object.entries(loadedFolders)
        .map(([f, stems]) => `${f}:${stems.length}`)
        .join('  ');
      console.log(`[PreloadScene] Flarepaw ✓  ${summary}`);
    } else {
      this.registry.set('flarepaw_sprite_key',         null);
      this.registry.set('flarepaw_anim_mode',          'none');
      this.registry.set('flarepaw_guard_loaded',       false);
      this.registry.set('flarepaw_flame_guard_loaded', false);
      this.registry.set('flarepaw_attack_loaded',      false);
      this.registry.set('flarepaw_hurt_loaded',        false);
      this.registry.set('flarepaw_jump_loaded',        false);
      console.warn('[PreloadScene] No Flarepaw frames found — placeholder graphics active.');
    }

    this.scene.start('TitleScene');
  }

  // Draws the content region of a raw texture onto a NORM_SIZE×NORM_SIZE canvas,
  // baseline-aligned.  Uses a reduced-resolution scan to locate opaque pixels so
  // large video-extracted frames (1440×1440) aren't shrunk to a postage stamp.
  private normalizeToCanvas(rawKey: string): string | null {
    if (!this.textures.exists(rawKey)) return null;
    const nk = normKey(rawKey);
    if (this.textures.exists(nk)) return nk;

    try {
      const src  = this.textures.get(rawKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const srcW = (src as HTMLImageElement).naturalWidth  || (src as HTMLCanvasElement).width  || 0;
      const srcH = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height || 0;
      if (!srcW || !srcH) return rawKey;

      // Step 1: find content bbox via reduced-resolution pixel scan (max 256px wide)
      const SCAN_MAX  = 256;
      const scanScale = Math.min(1, SCAN_MAX / Math.max(srcW, srcH));
      const scanW     = Math.max(1, Math.round(srcW * scanScale));
      const scanH     = Math.max(1, Math.round(srcH * scanScale));

      const scanCanvas  = document.createElement('canvas');
      scanCanvas.width  = scanW;
      scanCanvas.height = scanH;
      const scanCtx     = scanCanvas.getContext('2d')!;
      scanCtx.drawImage(src as CanvasImageSource, 0, 0, scanW, scanH);
      const pixels      = scanCtx.getImageData(0, 0, scanW, scanH).data;

      let minX = scanW, maxX = -1, minY = scanH, maxY = -1;
      for (let y = 0; y < scanH; y++) {
        for (let x = 0; x < scanW; x++) {
          if (pixels[(y * scanW + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Map bbox back to source space with a small padding margin
      let contentX = 0, contentY = 0, contentW = srcW, contentH = srcH;
      if (minX <= maxX && minY <= maxY) {
        const pad = Math.ceil(4 / scanScale);
        contentX  = Math.max(0, Math.floor(minX / scanScale) - pad);
        contentY  = Math.max(0, Math.floor(minY / scanScale) - pad);
        const r   = Math.min(srcW, Math.ceil((maxX + 1) / scanScale) + pad);
        const b   = Math.min(srcH, Math.ceil((maxY + 1) / scanScale) + pad);
        contentW  = r - contentX;
        contentH  = b - contentY;
      }

      // Step 2: draw only the content region into NORM_SIZE canvas, baseline-aligned
      const canvas  = document.createElement('canvas');
      canvas.width  = NORM_SIZE;
      canvas.height = NORM_SIZE;
      const ctx     = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const availW = NORM_SIZE - 20;
      const availH = NORM_SIZE - NORM_BASE - 10;
      const scale  = Math.min(availW / contentW, availH / contentH);
      const dw     = contentW * scale;
      const dh     = contentH * scale;
      const dx     = (NORM_SIZE - dw) / 2;
      const dy     = NORM_SIZE - NORM_BASE - dh;

      ctx.drawImage(src as CanvasImageSource, contentX, contentY, contentW, contentH, dx, dy, dw, dh);
      this.textures.addCanvas(nk, canvas);
      return nk;
    } catch {
      return rawKey;
    }
  }

  // Registers Phaser animations from the pre-filtered loadedFolders map.
  // loadedFolders contains only stems that actually loaded — missing frames
  // have already been filtered out before this is called.
  private normalizeAndRegister(
    loadedFolders: Record<string, string[]>,
  ): string | null {
    const normCache: Record<string, string[]> = {};
    const normFolder = (folder: string): string[] => {
      if (normCache[folder]) return normCache[folder];
      const stems  = loadedFolders[folder] ?? [];
      const result = stems
        .map(stem => this.normalizeToCanvas(phaserKey(folder, stem)))
        .filter((k): k is string => k !== null);
      normCache[folder] = result;
      return result;
    };

    // Register simple folder → single Phaser animation
    for (const [folder, cfg] of Object.entries(ANIM_CONFIG)) {
      if (!loadedFolders[folder]) continue;
      const normKeys = normFolder(folder);
      if (normKeys.length === 0) continue;
      if (this.anims.exists(cfg.animKey)) this.anims.remove(cfg.animKey);
      this.anims.create({
        key: cfg.animKey,
        frames: normKeys.map(k => ({ key: k })),
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      });
      console.log(`[PreloadScene] registered ${cfg.animKey} (${normKeys.length}f)`);
    }

    // Jump folder → 3 phase-animations (takeoff / air-hold / land)
    if (loadedFolders['jump']) {
      const normJump = normFolder('jump');
      if (normJump.length >= 1) {
        const takeoff = normJump.length >= 2
          ? normJump.slice(0, 2)
          : normJump;
        const air = normJump.length >= 3
          ? normJump.slice(2, Math.max(3, normJump.length - 1))
          : normJump.slice(0, 1);
        const land = normJump.slice(-1);

        const phases = [
          { key: 'flarepaw_jump_takeoff', frames: takeoff, frameRate: 14, repeat: 0  },
          { key: 'flarepaw_jump_air',     frames: air,     frameRate: 1,  repeat: -1 },
          { key: 'flarepaw_jump_land',    frames: land,    frameRate: 1,  repeat: 0  },
        ];
        for (const { key, frames, frameRate, repeat } of phases) {
          if (this.anims.exists(key)) this.anims.remove(key);
          this.anims.create({ key, frames: frames.map(k => ({ key: k })), frameRate, repeat });
        }
        console.log(`[PreloadScene] registered jump phases (${normJump.length}f split into 3)`);
      }
    }

    // First valid texture key for sprite initialisation in MinariFighter
    return normFolder('idle')[0] ?? normFolder('run')[0] ?? null;
  }
}
