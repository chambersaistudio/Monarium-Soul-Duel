import Phaser from 'phaser';

const FRAME_BASE = 'assets/characters/flarepaw';
const NORM_SIZE  = 512;  // target canvas size for all normalised frames (px)
const NORM_BASE  = 40;   // px from canvas bottom kept below feet baseline

// ── Frame key groups ───────────────────────────────────────────────────────────
const IDLE_KEYS   = ['fp_idle_000','fp_idle_001','fp_idle_002','fp_idle_003','fp_idle_004'];
const RUN_KEYS    = ['fp_run_001', 'fp_run_002', 'fp_run_003', 'fp_run_004', 'fp_run_005'];
const JUMP_KEYS   = ['fp_jump_001','fp_jump_002','fp_jump_003','fp_jump_004','fp_jump_005'];
// Attack frames — video-extracted names with skipped numbers are fine; sorted numerically below
const ATTACK_KEYS = ['fp_atk_054','fp_atk_055','fp_atk_056','fp_atk_058'];

// Sorts frame keys by the trailing integer so skipped numbers stay in the right order.
// e.g. ['fp_atk_058','fp_atk_054'] → ['fp_atk_054','fp_atk_058']
function sortByFrameNumber(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const na = parseInt(a.match(/\d+$/)?.[0] ?? '0', 10);
    const nb = parseInt(b.match(/\d+$/)?.[0] ?? '0', 10);
    return na - nb;
  });
}

// ── Load manifest: Phaser key → public path ────────────────────────────────────
const LOAD_SPECS: Array<{ key: string; path: string }> = [
  { key: 'fp_idle_000', path: `${FRAME_BASE}/idle/idle_000.png` },
  { key: 'fp_idle_001', path: `${FRAME_BASE}/idle/idle_001.png` },
  { key: 'fp_idle_002', path: `${FRAME_BASE}/idle/idle_002.png` },
  { key: 'fp_idle_003', path: `${FRAME_BASE}/idle/idle_003.png` },
  { key: 'fp_idle_004', path: `${FRAME_BASE}/idle/idle_004.png` },
  { key: 'fp_run_001',  path: `${FRAME_BASE}/run/run_001.png` },
  { key: 'fp_run_002',  path: `${FRAME_BASE}/run/run_002.png` },
  { key: 'fp_run_003',  path: `${FRAME_BASE}/run/run_003.png` },
  { key: 'fp_run_004',  path: `${FRAME_BASE}/run/run_004.png` },
  { key: 'fp_run_005',  path: `${FRAME_BASE}/run/run_005.png` },
  { key: 'fp_jump_001', path: `${FRAME_BASE}/jump/jump_001.png` },
  { key: 'fp_jump_002', path: `${FRAME_BASE}/jump/jump_002.png` },
  { key: 'fp_jump_003', path: `${FRAME_BASE}/jump/jump_003.png` },
  { key: 'fp_jump_004', path: `${FRAME_BASE}/jump/jump_004.png` },
  { key: 'fp_jump_005', path: `${FRAME_BASE}/jump/jump_005.png` },
  { key: 'fp_guard_001',       path: `${FRAME_BASE}/guard/guard_001.png` },
  { key: 'fp_flame_guard_001', path: `${FRAME_BASE}/flame_guard/flame_guard_001.png` },
  // Attack frames (video-extracted, skipped numbers allowed)
  { key: 'fp_atk_054', path: `${FRAME_BASE}/attack/frame_054.png` },
  { key: 'fp_atk_055', path: `${FRAME_BASE}/attack/frame_055.png` },
  { key: 'fp_atk_056', path: `${FRAME_BASE}/attack/frame_056.png` },
  { key: 'fp_atk_058', path: `${FRAME_BASE}/attack/frame_058.png` },
];

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

    for (const { key, path } of LOAD_SPECS) {
      this.load.image(key, path);
    }
  }

  create(): void {
    const loaded = (k: string) => this.textures.exists(k) && !this.loadErrors.has(k);

    const idleOk   = IDLE_KEYS.every(loaded);
    const runOk    = RUN_KEYS.every(loaded);
    const jumpOk   = JUMP_KEYS.every(loaded);
    const guardOk  = loaded('fp_guard_001');
    const fgOk     = loaded('fp_flame_guard_001');
    const attackOk = ATTACK_KEYS.every(loaded);

    if (idleOk || runOk || jumpOk) {
      const firstKey = this.normalizeAndRegister(idleOk, runOk, jumpOk, guardOk, fgOk, attackOk);
      this.registry.set('flarepaw_sprite_key', firstKey);
      this.registry.set('flarepaw_anim_mode', 'frames');
      this.registry.set('flarepaw_guard_loaded', guardOk);
      this.registry.set('flarepaw_flame_guard_loaded', fgOk);
      this.registry.set('flarepaw_attack_loaded', attackOk);
      console.log(`[PreloadScene] Flarepaw frames loaded ✓  guard:${guardOk}  flame_guard:${fgOk}  attack:${attackOk}`);
      if (!guardOk)  console.warn('[PreloadScene] guard_001.png failed to load — check path: assets/characters/flarepaw/guard/guard_001.png');
      if (!fgOk)     console.warn('[PreloadScene] flame_guard_001.png failed to load — check path: assets/characters/flarepaw/flame_guard/flame_guard_001.png');
      if (!attackOk) console.warn('[PreloadScene] attack frames failed to load — check path: assets/characters/flarepaw/attack/frame_054.png … frame_058.png');
    } else {
      this.registry.set('flarepaw_sprite_key', null);
      this.registry.set('flarepaw_anim_mode', 'none');
      this.registry.set('flarepaw_guard_loaded', false);
      this.registry.set('flarepaw_flame_guard_loaded', false);
      this.registry.set('flarepaw_attack_loaded', false);
      console.warn('[PreloadScene] No Flarepaw frames found — placeholder graphics active.');
    }

    this.scene.start('TitleScene');
  }

  // 'fp_idle_000' → 'fpn_idle_000'  (prefix swap fp → fpn)
  private normKey(rawKey: string): string {
    return 'fpn' + rawKey.slice(2);
  }

  // Draws a raw Phaser texture onto a NORM_SIZE×NORM_SIZE canvas, baseline-aligned.
  // Returns the normalised texture key (or the raw key if normalisation fails).
  private normalizeToCanvas(rawKey: string): string | null {
    if (!this.textures.exists(rawKey)) return null;
    const nk = this.normKey(rawKey);
    if (this.textures.exists(nk)) return nk;

    try {
      const src  = this.textures.get(rawKey).getSourceImage() as
        HTMLImageElement | HTMLCanvasElement;
      const srcW = (src as HTMLImageElement).naturalWidth  || (src as HTMLCanvasElement).width  || 0;
      const srcH = (src as HTMLImageElement).naturalHeight || (src as HTMLCanvasElement).height || 0;
      if (!srcW || !srcH) return rawKey;

      const canvas = document.createElement('canvas');
      canvas.width  = NORM_SIZE;
      canvas.height = NORM_SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Scale to fit available area (10px side margin, NORM_BASE bottom, 10px top clearance)
      const availW = NORM_SIZE - 20;
      const availH = NORM_SIZE - NORM_BASE - 10;
      const scale  = Math.min(availW / srcW, availH / srcH);
      const dw = srcW * scale;
      const dh = srcH * scale;
      const dx = (NORM_SIZE - dw) / 2;               // horizontal centre
      const dy = NORM_SIZE - NORM_BASE - dh;          // baseline-aligned

      ctx.drawImage(src as CanvasImageSource, dx, dy, dw, dh);
      this.textures.addCanvas(nk, canvas);
      return nk;
    } catch {
      return rawKey;
    }
  }

  private normalizeAndRegister(
    idleOk: boolean, runOk: boolean, jumpOk: boolean,
    guardOk: boolean, fgOk: boolean, attackOk: boolean,
  ): string | null {
    const normAll = (keys: string[]) =>
      keys.map(k => this.normalizeToCanvas(k)).filter((k): k is string => k !== null);

    const normIdle   = idleOk   ? normAll(IDLE_KEYS)                              : [];
    const normRun    = runOk    ? normAll(RUN_KEYS)                               : [];
    const normJump   = jumpOk   ? normAll(JUMP_KEYS)                              : [];
    const normGuard  = guardOk  ? normAll(['fp_guard_001'])                       : [];
    const normFG     = fgOk     ? normAll(['fp_flame_guard_001'])                 : [];
    // Numeric sort ensures frame_054 < frame_055 < frame_056 < frame_058 even with gaps
    const normAttack = attackOk ? normAll(sortByFrameNumber(ATTACK_KEYS))         : [];

    type AnimSpec = { animKey: string; frameRate: number; repeat: number; normKeys: string[] };
    const animSpecs: AnimSpec[] = [
      { animKey: 'flarepaw_idle',         frameRate: 6,  repeat: -1, normKeys: normIdle           },
      { animKey: 'flarepaw_run',          frameRate: 10, repeat: -1, normKeys: normRun            },
      // Jump split into 3 phases: takeoff (001-002), air-hold (003), landing (005)
      { animKey: 'flarepaw_jump_takeoff', frameRate: 14, repeat: 0,  normKeys: normJump.slice(0, 2) },
      { animKey: 'flarepaw_jump_air',     frameRate: 1,  repeat: -1, normKeys: normJump.slice(2, 3) },
      { animKey: 'flarepaw_jump_land',    frameRate: 1,  repeat: 0,  normKeys: normJump.slice(4, 5) },
      // Held-state single-frame animations use repeat:-1 so isPlaying stays true
      { animKey: 'flarepaw_guard',        frameRate: 1,  repeat: -1, normKeys: normGuard          },
      { animKey: 'flarepaw_flame_guard',  frameRate: 1,  repeat: -1, normKeys: normFG             },
      // Attack: plays once, no loop — frame_054=startup, 055+056=active hit, 058=recovery
      { animKey: 'flarepaw_attack',       frameRate: 12, repeat: 0,  normKeys: normAttack         },
    ];

    for (const { animKey, frameRate, repeat, normKeys } of animSpecs) {
      if (normKeys.length === 0) continue;
      if (this.anims.exists(animKey)) this.anims.remove(animKey);
      this.anims.create({
        key: animKey,
        frames: normKeys.map(k => ({ key: k })),
        frameRate,
        repeat,
      });
    }

    // First valid texture key for sprite initialisation in MinariFighter
    return normIdle[0] ?? normRun[0] ?? normJump[0] ?? null;
  }
}
