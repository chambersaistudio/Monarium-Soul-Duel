import Phaser from 'phaser';
import { CHARACTERS_MANIFEST } from '../generated/characters-manifest';
import { ANIM_CONFIG, JUMP_PHASE_CONFIG, DEFAULT_ANIM_CONFIG } from '../config/animationConfig';
import { CHARACTER_RENDER_CONFIG, DEFAULT_RENDER_CONFIG } from '../config/characterConfig';
import { AUDIO_FILES } from '../config/audioConfig';
import {
  SAFE_MODE,
  SAFE_SKIP_FOLDERS,
  SAFE_MAX_FRAMES,
  NORM_SIZE,
} from '../config/mobileConfig';
import { setBootLoading } from '../ui/bootOverlay';
const NORM_BASE = 40;  // px of transparent space below feet in normalised canvas

type ManifestJSON = { character?: string; generated?: string; animations?: Record<string, string[]> };

function phaserKey(charId: string, folder: string, stem: string): string {
  return `${charId}_${folder}_${stem}`;
}

function normKey(rawKey: string): string {
  return `n_${rawKey}`;
}

// Return at most maxCount evenly-spaced items from the array.
// Always includes the first frame so animation registration has something to work with.
function thinFrames(stems: readonly string[], maxCount: number): string[] {
  if (stems.length <= maxCount) return [...stems];
  const result: string[] = [];
  const step = stems.length / maxCount;
  for (let i = 0; i < maxCount; i++) {
    result.push(stems[Math.min(Math.floor(i * step), stems.length - 1)]);
  }
  return result;
}

export class PreloadScene extends Phaser.Scene {
  private loadErrors = new Set<string>();
  private loadingTrack!: Phaser.GameObjects.Rectangle;
  private loadingBar!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private safeModeText: Phaser.GameObjects.Text | null = null;
  private debugText: Phaser.GameObjects.Text | null = null;
  private progressValue = 0;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    // ── Loading bar ────────────────────────────────────────────────────────
    this.loadingTrack = this.add.rectangle(0, 0, 300, 20, 0x222222);
    this.loadingBar = this.add.rectangle(0, 0, 0, 16, 0xff6600).setOrigin(0, 0.5);
    this.titleText = this.add.text(0, 0, 'MONARIUM', {
      fontSize: '32px', color: '#ff6600', fontStyle: 'bold', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Status line — always visible so mobile users can see progress before crash
    this.statusText = this.add.text(0, 0, 'Loading assets…', {
      fontSize: '11px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    if (SAFE_MODE) {
      this.safeModeText = this.add.text(0, 0, `Safe mode — ${NORM_SIZE}px textures`, {
        fontSize: '10px', color: '#446644', fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')) {
      this.debugText = this.add.text(0, 0, '', {
        fontSize: '9px', color: '#777777', fontFamily: 'monospace', align: 'center',
      }).setOrigin(0.5, 1);
    }

    this.layoutLoadingScreen();
    this.children.list.forEach(child => { if ('setVisible' in child) (child as unknown as { setVisible: (visible: boolean) => void }).setVisible(false); });
    setBootLoading(this.progressValue, 'Loading assets…', SAFE_MODE);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutLoadingScreen, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutLoadingScreen, this);
    });

    this.load.on('progress',     (v: number) => {
      this.progressValue = v;
      this.layoutLoadingScreen();
      setBootLoading(v, this.statusText.text, SAFE_MODE);
    });
    this.load.on('fileprogress', (f: Phaser.Loader.File) => {
      const label = f.key.length > 48 ? `…${f.key.slice(-44)}` : f.key;
      this.statusText.setText(label);
      this.layoutLoadingScreen();
      setBootLoading(this.progressValue, label, SAFE_MODE);
    });
    this.load.on('loaderror', (f: Phaser.Loader.File) => { this.loadErrors.add(f.key); });

    // ── Character sprites ──────────────────────────────────────────────────
    for (const [charId, manifest] of Object.entries(CHARACTERS_MANIFEST)) {
      // Load runtime JSON manifest first.  On complete, queue any frames it lists
      // that aren't already queued from the compile-time manifest.
      const jsonKey = `${charId}_manifest`;
      this.load.json(jsonKey, `${manifest.base}/sprite-manifest.json`);
      this.load.on(`filecomplete-json-${jsonKey}`, () => {
        const json = this.cache.json.get(jsonKey) as ManifestJSON | null;
        if (!json?.animations) return;
        for (const [folder, stems] of Object.entries(json.animations)) {
          if (SAFE_MODE && SAFE_SKIP_FOLDERS.has(folder)) continue;
          const filtered = SAFE_MODE ? thinFrames(stems, SAFE_MAX_FRAMES) : stems;
          for (const stem of filtered) {
            const key = phaserKey(charId, folder, stem);
            if (!this.textures.exists(key)) {
              this.load.image(key, `${manifest.base}/${folder}/${stem}.png`);
            }
          }
        }
      });

      // Seed the load queue from the compile-time manifest so frames load even
      // if sprite-manifest.json is absent or stale.
      for (const [folder, stems] of Object.entries(manifest.animations)) {
        if (SAFE_MODE && SAFE_SKIP_FOLDERS.has(folder)) continue;
        const filtered = SAFE_MODE ? thinFrames(stems, SAFE_MAX_FRAMES) : (stems as string[]);
        for (const stem of filtered) {
          this.load.image(phaserKey(charId, folder, stem), `${manifest.base}/${folder}/${stem}.png`);
        }
      }
    }

    // ── Overworld backgrounds ──────────────────────────────────────────────
    // Load all 6 maps upfront so scene transitions are instant.
    const owBgs: Array<[string, string]> = [
      ['ow_bg_starter_village',   'assets/backgrounds/overworld/starter_village.png'],
      ['ow_bg_bond_lab_interior', 'assets/backgrounds/overworld/bond_lab_interior.png'],
      ['ow_bg_training_field',    'assets/backgrounds/overworld/training_field.png'],
      ['ow_bg_forest_route',      'assets/backgrounds/overworld/forest_route.png'],
      ['ow_bg_crystal_cave',      'assets/backgrounds/overworld/crystal_cave.png'],
      ['ow_bg_coastal_beach',     'assets/backgrounds/overworld/coastal_beach.png'],
    ];
    for (const [key, path] of owBgs) {
      this.load.image(key, path);
    }

    // ── Overworld logic masks (optional — 404 silently ignored) ───────────
    // Paint these PNGs using the color codes in OverworldMaskSystem.ts and
    // drop them next to the background images.  The game works without them.
    const owMasks: Array<[string, string]> = [
      ['ow_mask_starter_village',   'assets/backgrounds/overworld/starter_village_mask.png'],
      ['ow_mask_bond_lab_interior', 'assets/backgrounds/overworld/bond_lab_interior_mask.png'],
      ['ow_mask_training_field',    'assets/backgrounds/overworld/training_field_mask.png'],
      ['ow_mask_forest_route',      'assets/backgrounds/overworld/forest_route_mask.png'],
      ['ow_mask_crystal_cave',      'assets/backgrounds/overworld/crystal_cave_mask.png'],
      ['ow_mask_coastal_beach',     'assets/backgrounds/overworld/coastal_beach_mask.png'],
    ];
    for (const [key, path] of owMasks) {
      this.load.image(key, path);
    }

    // ── Audio ──────────────────────────────────────────────────────────────
    // All files are optional — 404s are captured by loaderror and the
    // AudioManager skips missing keys at runtime.
    for (const [key, paths] of Object.entries(AUDIO_FILES)) {
      this.load.audio(key, paths);
    }

    // ── Sproutodon fullbody reference (no animation frames available) ────────
    this.load.image('sproutodon_fullbody', 'assets/monari/sproutodon/reference/fullbody.png');
  }

  private layoutLoadingScreen(): void {
    const w = Math.max(1, this.scale.width || this.scale.gameSize.width);
    const h = Math.max(1, this.scale.height || this.scale.gameSize.height);
    const cx = w / 2;
    const cy = h / 2;
    const barW = Math.min(300, Math.max(180, w - 48));
    const titleSize = Math.max(24, Math.min(34, Math.floor(w / 12)));

    this.titleText?.setPosition(cx, cy - 44).setFontSize(titleSize);
    this.loadingTrack?.setPosition(cx, cy).setSize(barW, 20);
    this.loadingBar?.setPosition(cx - (barW - 4) / 2, cy).setSize((barW - 4) * this.progressValue, 16);
    this.statusText?.setPosition(cx, cy + 30);
    this.safeModeText?.setPosition(cx, cy + 50);

    if (this.debugText) {
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const orientation = w >= h ? 'landscape' : 'portrait';
      this.debugText
        .setPosition(cx, h - 8)
        .setText([
          `viewport ${Math.round(window.visualViewport?.width ?? window.innerWidth)}x${Math.round(window.visualViewport?.height ?? window.innerHeight)} ${orientation}`,
          `scale ${Math.round(w)}x${Math.round(h)} css ${Math.round(rect.width)}x${Math.round(rect.height)} internal ${canvas.width}x${canvas.height}`,
          `camera zoom ${this.cameras.main.zoom.toFixed(2)} center ${Math.round(cx)},${Math.round(cy)}`,
        ]);
    }
  }

  create(): void {
    setBootLoading(1, 'Assets ready', SAFE_MODE);
    for (const charId of Object.keys(CHARACTERS_MANIFEST)) {
      this.createCharacter(charId);
    }

    // Sproutodon has no animation frames — use static fullbody image if it loaded
    if (!this.loadErrors.has('sproutodon_fullbody') && this.textures.exists('sproutodon_fullbody')) {
      this.registry.set('sproutodon_sprite_key', 'sproutodon_fullbody');
      this.registry.set('sproutodon_anim_mode',  'static');
    } else {
      this.registry.set('sproutodon_sprite_key', null);
      this.registry.set('sproutodon_anim_mode',  'none');
    }

    // Complete the DOM progress bar then fade-dismiss the boot overlay.
    const barEl   = document.getElementById('boot-bar')     as HTMLDivElement | null;
    const overlay = document.getElementById('boot-overlay') as HTMLDivElement | null;
    if (barEl)   barEl.style.width = '100%';
    if (overlay) {
      overlay.classList.add('fade-out');
    }

    // Stop the opening cinematic overlay (removes the video DOM element via its
    // SHUTDOWN handler) and transition to the title screen.
    if (this.scene.isActive('SplashScene')) {
      this.scene.stop('SplashScene');
    }
    this.scene.start('TitleScene');
  }

  private createCharacter(charId: string): void {
    const manifest = CHARACTERS_MANIFEST[charId];
    const jsonKey  = `${charId}_manifest`;

    const jsonOk = !this.loadErrors.has(jsonKey) && this.cache.json.has(jsonKey);
    const sourceFrames: Record<string, readonly string[]> =
      jsonOk
        ? ((this.cache.json.get(jsonKey) as ManifestJSON).animations ?? manifest.animations)
        : manifest.animations;

    if (jsonOk) {
      console.log(`[PreloadScene] ${charId}: using runtime sprite-manifest.json`);
    } else {
      console.log(`[PreloadScene] ${charId}: sprite-manifest.json absent — using compile-time manifest`);
    }

    const loaded = (k: string) => this.textures.exists(k) && !this.loadErrors.has(k);

    // Build per-folder frame lists from ONLY the frames that actually loaded.
    // Missing frames are skipped with a warning instead of breaking the animation.
    const loadedFolders: Record<string, string[]> = {};
    for (const [folder, stems] of Object.entries(sourceFrames)) {
      // In safe mode, skip folders that aren't needed (some might appear in the runtime JSON)
      if (SAFE_MODE && SAFE_SKIP_FOLDERS.has(folder)) continue;

      const ok      = (stems as string[]).filter(s => loaded(phaserKey(charId, folder, s)));
      const skipped = (stems as string[]).filter(s => !loaded(phaserKey(charId, folder, s)));

      if (skipped.length > 0) {
        console.warn(`[PreloadScene] ${charId}/${folder}: skipped ${skipped.length} frame(s)`);
      }
      if (ok.length > 0) {
        loadedFolders[folder] = ok;
        console.log(`[PreloadScene] ${charId}/${folder} (${ok.length}f): [${ok.join(', ')}]`);
      }
    }

    if (loadedFolders['idle'] || loadedFolders['run']) {
      const firstKey = this.registerCharacterAnims(charId, loadedFolders);
      this.registry.set(`${charId}_sprite_key`, firstKey);
      this.registry.set(`${charId}_anim_mode`,  'frames');

      for (const folder of Object.keys(ANIM_CONFIG)) {
        this.registry.set(`${charId}_${folder}_loaded`, !!loadedFolders[folder]);
      }
      this.registry.set(`${charId}_jump_loaded`, !!loadedFolders['jump']);

      const summary = Object.entries(loadedFolders).map(([f, s]) => `${f}:${s.length}`).join('  ');
      console.log(`[PreloadScene] ${charId} ✓  ${summary}`);
    } else {
      this.registry.set(`${charId}_sprite_key`, null);
      this.registry.set(`${charId}_anim_mode`,  'none');

      for (const folder of Object.keys(ANIM_CONFIG)) {
        this.registry.set(`${charId}_${folder}_loaded`, false);
      }
      this.registry.set(`${charId}_jump_loaded`, false);
      console.warn(`[PreloadScene] No ${charId} frames found — placeholder graphics active.`);
    }
  }

  // Draws the content region of a raw texture onto a NORM_SIZE×NORM_SIZE canvas,
  // baseline-aligned.  Uses a reduced-resolution scan to locate opaque pixels so
  // large video-extracted frames (1440×1440) aren't shrunk to a postage stamp.
  //
  // IMPORTANT: After successful normalization, the raw texture is REMOVED from
  // Phaser's cache to free the original 1440×1440 GPU/CPU memory (~8 MB per frame).
  // This reduces peak memory from ~600 MB to ~50 MB on mobile.
  private normalizeToCanvas(rawKey: string): string | null {
    if (!this.textures.exists(rawKey)) return null;
    const nk = normKey(rawKey);
    if (this.textures.exists(nk)) {
      // Already normalized — clean up stale raw if still around
      if (this.textures.exists(rawKey)) {
        try { this.textures.remove(rawKey); } catch { /* ok */ }
      }
      return nk;
    }

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

      // Release the original 1440×1440 texture from GPU/CPU memory immediately.
      // The normalized canvas (NORM_SIZE×NORM_SIZE) is now the only copy needed.
      try { this.textures.remove(rawKey); } catch { /* ok */ }

      return nk;
    } catch {
      return rawKey;  // keep raw as fallback if normalization failed
    }
  }

  // Registers all Phaser animations for a single character from pre-filtered loadedFolders.
  // Standard folders use ANIM_CONFIG; unknown folders fall back to DEFAULT_ANIM_CONFIG;
  // the 'jump' folder is split into three phase-animations.
  private registerCharacterAnims(
    charId: string,
    loadedFolders: Record<string, string[]>,
  ): string | null {
    const normCache: Record<string, string[]> = {};
    const normFolder = (folder: string): string[] => {
      if (normCache[folder]) return normCache[folder];
      const stems  = loadedFolders[folder] ?? [];
      const result = stems
        .map(stem => this.normalizeToCanvas(phaserKey(charId, folder, stem)))
        .filter((k): k is string => k !== null);
      normCache[folder] = result;
      return result;
    };

    const renderCfg  = CHARACTER_RENDER_CONFIG[charId] ?? DEFAULT_RENDER_CONFIG;
    const overrides  = renderCfg.animOverrides ?? {};

    // Standard folders from ANIM_CONFIG (with optional per-character overrides)
    for (const [folder, baseCfg] of Object.entries(ANIM_CONFIG)) {
      if (!loadedFolders[folder]) continue;
      const normKeys = normFolder(folder);
      if (normKeys.length === 0) continue;
      const animKey = `${charId}_${folder}`;
      const cfg = { ...baseCfg, ...(overrides[folder] ?? {}) };
      if (this.anims.exists(animKey)) this.anims.remove(animKey);
      this.anims.create({
        key: animKey,
        frames: normKeys.map(k => ({ key: k })),
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      });
      console.log(`[PreloadScene] registered ${animKey} (${normKeys.length}f)`);
    }

    // Unknown folders (custom Monari abilities not yet in ANIM_CONFIG) use defaults
    for (const folder of Object.keys(loadedFolders)) {
      if (folder in ANIM_CONFIG || folder === 'jump') continue;
      const normKeys = normFolder(folder);
      if (normKeys.length === 0) continue;
      const animKey = `${charId}_${folder}`;
      if (this.anims.exists(animKey)) this.anims.remove(animKey);
      this.anims.create({
        key: animKey,
        frames: normKeys.map(k => ({ key: k })),
        frameRate: DEFAULT_ANIM_CONFIG.frameRate,
        repeat: DEFAULT_ANIM_CONFIG.repeat,
      });
      console.log(`[PreloadScene] registered ${animKey} (${normKeys.length}f) [default config]`);
    }

    // Jump folder → 3 phase-animations (takeoff / air-hold / land)
    // Skip when individual phase folders are present (new pipeline) to avoid key conflicts.
    if (loadedFolders['jump'] && !loadedFolders['jump_air']) {
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
          { key: `${charId}_jump_takeoff`, frames: takeoff, ...JUMP_PHASE_CONFIG.takeoff },
          { key: `${charId}_jump_air`,     frames: air,     ...JUMP_PHASE_CONFIG.air     },
          { key: `${charId}_jump_land`,    frames: land,    ...JUMP_PHASE_CONFIG.land    },
        ];
        for (const { key, frames, frameRate, repeat } of phases) {
          if (this.anims.exists(key)) this.anims.remove(key);
          this.anims.create({ key, frames: frames.map(k => ({ key: k })), frameRate, repeat });
        }
        console.log(`[PreloadScene] registered ${charId} jump phases (${normJump.length}f split into 3)`);
      }
    }

    // First valid texture key for sprite initialisation in MinariFighter
    return normFolder('idle')[0] ?? normFolder('run')[0] ?? null;
  }
}
