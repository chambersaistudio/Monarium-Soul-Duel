import Phaser from 'phaser';
import type { MinariData } from '../types/minari';
import { CHARACTER_RENDER_CONFIG, DEFAULT_RENDER_CONFIG } from '../config/characterConfig';
import { NORM_SIZE, IS_TOUCH_DEVICE } from '../config/mobileConfig';
import { CombatFormulaSystem } from '../systems/CombatFormulaSystem';
import type { ComputedBattleStats } from '../systems/CombatFormulaSystem';
import { MONARI_DEX } from '../data/monariDex';

// On mobile the normalized texture is 256 px (vs 512 px desktop), so SPRITE_SCALE
// must be computed from the actual NORM_SIZE to get the correct display height.
// Mobile uses a slightly smaller display height so characters don't overwhelm the
// compact landscape viewport (≈390 px tall).
const DISPLAY_HEIGHT = IS_TOUCH_DEVICE ? 170 : 220;
const NORM_BASE      = 40;
const SPRITE_SCALE   = DISPLAY_HEIGHT / NORM_SIZE;
const FEET_OFFSET    = Math.round(NORM_BASE * SPRITE_SCALE);

/**
 * A position-driven battle actor for Classic Soul Duel.
 * Unlike MinariFighter there is no arcade physics — the engine
 * moves the actor via Phaser tweens.  The shadow tracks the actor
 * each frame via updateShadow().
 */
export class ClassicActor extends Phaser.GameObjects.Container {
  readonly actorId: string;
  readonly isPlayer: boolean;
  readonly minariData: MinariData;

  hp: number;
  maxHp: number;
  aura: number;
  maxAura: number;
  /** Combat level (1–100); scales HP, Aura, and stat effectiveness. */
  readonly combatLevel: number;
  /** Computed battle stats derived from base stats + level. */
  readonly computedStats: ComputedBattleStats;
  /** True while this actor is in a guard stance (set/cleared by ClassicBattleEngine). */
  isGuarding = false;
  /** True if this actor used a guard/stance move last turn. Reset at turn end. */
  usedGuardLastTurn = false;

  private sprite:    Phaser.GameObjects.Sprite | null   = null;
  private body_gfx:  Phaser.GameObjects.Graphics | null = null;
  private shadow:    Phaser.GameObjects.Ellipse;
  private useSprite = false;
  private lastAnim  = '';
  private spriteFacingRight = true;

  facing: 1 | -1;

  constructor(
    scene:        Phaser.Scene,
    x:            number,
    y:            number,
    data:         MinariData,
    isPlayer:     boolean,
    combatLevel = 1,
  ) {
    super(scene, x, y);
    this.actorId     = data.id;
    this.isPlayer    = isPlayer;
    this.minariData  = data;
    this.combatLevel = Math.max(1, combatLevel);
    this.facing      = isPlayer ? 1 : -1;

    // Derive battle stats from monariDex base stats + level
    const baseStats     = MONARI_DEX[data.id]?.baseStats;
    this.computedStats  = CombatFormulaSystem.calcBattleStats(baseStats, this.combatLevel);
    this.maxHp          = this.computedStats.maxHp;
    this.hp             = this.maxHp;
    this.maxAura        = this.computedStats.maxAura;
    this.aura           = this.maxAura;

    const renderCfg = CHARACTER_RENDER_CONFIG[data.id] ?? DEFAULT_RENDER_CONFIG;
    this.spriteFacingRight = renderCfg.spriteFacingRight;

    // Shadow lives in scene space so it stays behind the container
    this.shadow = scene.add.ellipse(x, y + data.bodyHeight / 2 + 5,
      data.bodyWidth * 1.5, 14, 0x000000, 0.3);
    scene.add.existing(this.shadow);

    // Prefer real sprite if one was registered by PreloadScene
    const animMode  = scene.registry.get(`${data.id}_anim_mode`)  as string | undefined;
    const spriteKey = scene.registry.get(`${data.id}_sprite_key`) as string | undefined;

    if (spriteKey && animMode !== 'none') {
      this.sprite    = scene.add.sprite(0, 0, spriteKey);
      this.useSprite = true;
      const isStatic = animMode === 'static';
      const scale    = isStatic
        ? DISPLAY_HEIGHT / Math.max(1, this.sprite.height)
        : SPRITE_SCALE;
      this.sprite.setScale(scale);
      this.sprite.setOrigin(0.5, 1);
      this.sprite.setPosition(0, data.bodyHeight / 2 + FEET_OFFSET + (isStatic ? 0 : renderCfg.spriteYOffset));
      this.add(this.sprite);
      if (!isStatic) this.setupAuraGlow();
    }

    // Placeholder body (always created; hidden when real sprite is loaded)
    this.body_gfx = scene.add.graphics();
    if (this.useSprite) {
      this.body_gfx.setVisible(false);
    } else {
      this.drawPlaceholder();
    }
    this.add(this.body_gfx);

    scene.add.existing(this);
    this.setDepth(10);
    this.updateFlip();
  }

  // ── Appearance ─────────────────────────────────────────────────────────────

  private drawPlaceholder(): void {
    const g = this.body_gfx!;
    g.clear();
    const d = this.minariData;
    g.fillStyle(d.colorPrimary, 1);
    if (d.bodyShape === 'circle') g.fillCircle(0, 0, d.bodyWidth / 2);
    else g.fillRoundedRect(-d.bodyWidth / 2, -d.bodyHeight / 2, d.bodyWidth, d.bodyHeight, 8);
    const eyeY = d.bodyShape === 'circle' ? -4 : -d.bodyHeight / 4;
    g.fillStyle(0xffffff, 1); g.fillCircle(8,  eyeY, 4); g.fillCircle(16, eyeY, 4);
    g.fillStyle(0x111111, 1); g.fillCircle(9,  eyeY, 2); g.fillCircle(17, eyeY, 2);
  }

  private updateFlip(): void {
    if (!this.sprite) return;
    this.sprite.setFlipX(this.spriteFacingRight ? this.facing === -1 : this.facing === 1);
  }

  setFacing(dir: 1 | -1): void {
    this.facing = dir;
    this.updateFlip();
  }

  // ── Animation ──────────────────────────────────────────────────────────────

  /**
   * Plays the named folder animation for this actor.
   * The animation key in Phaser is '${actorId}_${folder}'.
   */
  playAnim(folder: string, forceRestart = false): void {
    if (!this.sprite) return;
    const key = `${this.actorId}_${folder}`;
    if (!this.scene.anims.exists(key)) return;
    if (!forceRestart && this.lastAnim === key && this.sprite.anims.isPlaying) return;
    this.lastAnim = key;
    this.sprite.play(key, true);
  }

  stopAnim(): void { this.sprite?.anims.stop(); }

  get isAnimPlaying():     boolean { return this.sprite?.anims.isPlaying ?? false; }
  get currentAnimKey():    string  { return this.lastAnim; }
  get spriteObject():      Phaser.GameObjects.Sprite | null { return this.sprite; }

  // ── Per-frame ──────────────────────────────────────────────────────────────

  /** Call every scene update to keep the shadow aligned under the actor. */
  updateShadow(): void {
    this.shadow.setPosition(this.x, this.y + this.minariData.bodyHeight / 2 + 5);
  }

  // ── Aura glow ──────────────────────────────────────────────────────────────

  private setupAuraGlow(): void {
    if (!this.sprite) return;
    // preFX is WebGL-only — optional chaining is safe; returns undefined on canvas
    const color = this.elementToAuraColor(this.minariData.element);
    const glow  = this.sprite.preFX?.addGlow(color, 1.0, 0, false, 0.05, 12);
    if (!glow) return;
    const obj = { s: 1.0 };
    this.scene.tweens.add({
      targets: obj, s: 2.0, duration: 2000,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onUpdate: () => { glow.outerStrength = obj.s; },
    });
  }

  private elementToAuraColor(element: string): number {
    const map: Record<string, number> = {
      fire:      0xff4400,
      water:     0x00aaff,
      shadow:    0x9922ff,
      wind:      0x44ff88,
      earth:     0x44ff88,
      lightning: 0xffdd00,
      light:     0xffeeaa,
      void:      0xcc00ff,
    };
    return map[element] ?? 0xffcc44;
  }

  flashDamage(): void {
    const target = this.sprite ?? this.body_gfx;
    if (!target) return;
    this.scene.tweens.killTweensOf(target);
    this.scene.tweens.add({
      targets: target, alpha: 0.1,
      duration: 50, yoyo: true, repeat: 3,
      onComplete: () => target.setAlpha(1),
    });
  }

  override destroy(): void {
    this.shadow.destroy();
    super.destroy();
  }
}
