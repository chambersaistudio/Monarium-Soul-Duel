import Phaser from 'phaser';
import { FLAREPAW_BASE, FLAREPAW_FRAMES } from '../generated/flarepaw-manifest';

const NORM_SIZE = 512;
const NORM_BASE = 40;  // px of transparent space below feet in normalised canvas

// Maps animation folder → Phaser animation config
const ANIM_CONFIG: Record<string, { animKey: string; frameRate: number; repeat: number }> = {
  idle:        { animKey: 'flarepaw_idle',       frameRate: 8,  repeat: -1 },
  run:         { animKey: 'flarepaw_run',         frameRate: 12, repeat: -1 },
  attack:      { animKey: 'flarepaw_attack',      frameRate: 12, repeat: 0  },
  hurt:        { animKey: 'flarepaw_hurt',        frameRate: 12, repeat: 0  },
  guard:       { animKey: 'flarepaw_guard',       frameRate: 8,  repeat: -1 },
  flame_guard: { animKey: 'flarepaw_flame_guard', frameRate: 12, repeat: -1 },
  // jump folder (if present) is split into 3 phase-animations below
};

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

    for (const [folder, stems] of Object.entries(FLAREPAW_FRAMES)) {
      for (const stem of stems) {
        this.load.image(phaserKey(folder, stem), `${FLAREPAW_BASE}/${folder}/${stem}.png`);
      }
    }
  }

  create(): void {
    const loaded = (k: string) => this.textures.exists(k) && !this.loadErrors.has(k);
    const folderOk = (folder: string) =>
      !!(FLAREPAW_FRAMES[folder]?.length && FLAREPAW_FRAMES[folder].every(s => loaded(phaserKey(folder, s))));

    const flags = {
      idleOk:   folderOk('idle'),
      runOk:    folderOk('run'),
      attackOk: folderOk('attack'),
      hurtOk:   folderOk('hurt'),
      guardOk:  folderOk('guard'),
      fgOk:     folderOk('flame_guard'),
      jumpOk:   folderOk('jump'),
    };

    if (flags.idleOk || flags.runOk) {
      const firstKey = this.normalizeAndRegister(flags);
      this.registry.set('flarepaw_sprite_key',        firstKey);
      this.registry.set('flarepaw_anim_mode',         'frames');
      this.registry.set('flarepaw_guard_loaded',      flags.guardOk);
      this.registry.set('flarepaw_flame_guard_loaded', flags.fgOk);
      this.registry.set('flarepaw_attack_loaded',     flags.attackOk);
      this.registry.set('flarepaw_hurt_loaded',       flags.hurtOk);
      this.registry.set('flarepaw_jump_loaded',       flags.jumpOk);

      const summary = (Object.entries(flags) as [string, boolean][])
        .filter(([, ok]) => ok)
        .map(([f, ]) => `${f.replace('Ok', '')}:${FLAREPAW_FRAMES[f.replace('Ok', '')]?.length ?? '?'}`)
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

      const scanCanvas   = document.createElement('canvas');
      scanCanvas.width   = scanW;
      scanCanvas.height  = scanH;
      const scanCtx      = scanCanvas.getContext('2d')!;
      scanCtx.drawImage(src as CanvasImageSource, 0, 0, scanW, scanH);
      const pixels       = scanCtx.getImageData(0, 0, scanW, scanH).data;

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
        const pad  = Math.ceil(4 / scanScale);
        contentX   = Math.max(0, Math.floor(minX / scanScale) - pad);
        contentY   = Math.max(0, Math.floor(minY / scanScale) - pad);
        const r    = Math.min(srcW, Math.ceil((maxX + 1) / scanScale) + pad);
        const b    = Math.min(srcH, Math.ceil((maxY + 1) / scanScale) + pad);
        contentW   = r - contentX;
        contentH   = b - contentY;
      }

      // Step 2: draw only the content region into NORM_SIZE canvas, baseline-aligned
      const canvas   = document.createElement('canvas');
      canvas.width   = NORM_SIZE;
      canvas.height  = NORM_SIZE;
      const ctx      = canvas.getContext('2d')!;
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

  private normalizeAndRegister(flags: {
    idleOk: boolean; runOk: boolean; attackOk: boolean;
    hurtOk: boolean; guardOk: boolean; fgOk: boolean; jumpOk: boolean;
  }): string | null {
    // Cache normalised key lists to avoid double-processing
    const normCache: Record<string, string[]> = {};
    const normFolder = (folder: string): string[] => {
      if (normCache[folder]) return normCache[folder];
      const result = FLAREPAW_FRAMES[folder]
        ?.map(stem => this.normalizeToCanvas(phaserKey(folder, stem)))
        .filter((k): k is string => k !== null) ?? [];
      normCache[folder] = result;
      return result;
    };

    // Register single-folder animations from ANIM_CONFIG
    const folderMap: Record<keyof typeof flags, string> = {
      idleOk:   'idle',
      runOk:    'run',
      attackOk: 'attack',
      hurtOk:   'hurt',
      guardOk:  'guard',
      fgOk:     'flame_guard',
      jumpOk:   'jump',
    };

    for (const [flag, folder] of Object.entries(folderMap) as [keyof typeof flags, string][]) {
      if (!flags[flag] || folder === 'jump') continue;
      const cfg = ANIM_CONFIG[folder];
      if (!cfg) continue;
      const normKeys = normFolder(folder);
      if (normKeys.length === 0) continue;
      if (this.anims.exists(cfg.animKey)) this.anims.remove(cfg.animKey);
      this.anims.create({
        key: cfg.animKey,
        frames: normKeys.map(k => ({ key: k })),
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      });
    }

    // Jump folder → 3 phase-animations (takeoff / air-hold / land)
    if (flags.jumpOk) {
      const normJump = normFolder('jump');
      if (normJump.length >= 1) {
        const takeoff = normJump.length >= 2 ? normJump.slice(0, 2)                          : normJump;
        const air     = normJump.length >= 3 ? normJump.slice(2, Math.max(3, normJump.length - 1)) : normJump.slice(0, 1);
        const land    = normJump.slice(-1);

        const jumpPhases = [
          { key: 'flarepaw_jump_takeoff', frames: takeoff, frameRate: 14, repeat: 0  },
          { key: 'flarepaw_jump_air',     frames: air,     frameRate: 1,  repeat: -1 },
          { key: 'flarepaw_jump_land',    frames: land,    frameRate: 1,  repeat: 0  },
        ];
        for (const { key, frames, frameRate, repeat } of jumpPhases) {
          if (this.anims.exists(key)) this.anims.remove(key);
          this.anims.create({ key, frames: frames.map(k => ({ key: k })), frameRate, repeat });
        }
      }
    }

    // First valid texture key for sprite initialisation in MinariFighter
    return normFolder('idle')[0] ?? normFolder('run')[0] ?? null;
  }
}
