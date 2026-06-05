import Phaser from 'phaser';
import type { MinariData, FighterStats } from '../types/minari';
import type { MoveData } from '../types/combat';
import { CORE_ATTACKS, MOVES, FORMS, ULTIMATES } from '../data/moveData';
import { FormSystem } from '../systems/FormSystem';
import { Projectile } from './Projectile';

export type FighterState =
  | 'idle' | 'run' | 'jump' | 'fall' | 'guard'
  | 'attacking' | 'special' | 'dodge' | 'hurt'
  | 'form_active' | 'stunned';

interface AttackState {
  active: boolean;
  comboIndex: number;
  lastComboTime: number;
  startupElapsed: number;
  activeElapsed: number;
  recoveryElapsed: number;
  phase: 'startup' | 'active' | 'recovery' | 'none';
  hitDealt: boolean;
}

// Target display height in pixels for the sprite in-game.
// PreloadScene normalises all frames to 512×512 with 40px baseline margin.
const DISPLAY_HEIGHT = 220;
const NORM_SIZE      = 512;
const SPRITE_SCALE   = DISPLAY_HEIGHT / NORM_SIZE;  // ≈ 0.43

export class MinariFighter extends Phaser.GameObjects.Container {
  readonly fighterId: string;
  readonly isPlayer: boolean;
  stats: FighterStats;
  minariData: MinariData;
  facing: 1 | -1;

  private body_gfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private useSprite = false;
  private lastAnim = '';

  // Flame Guard
  private flameGuardActive = false;
  private flameGuardTimer  = 0;
  private flameGuardGfx: Phaser.GameObjects.Graphics | null = null;

  state: FighterState = 'idle';
  formSystem: FormSystem;

  private phBody!: Phaser.Physics.Arcade.Body;
  private grounded = false;

  private attackState: AttackState = {
    active: false, comboIndex: 0, lastComboTime: 0,
    startupElapsed: 0, activeElapsed: 0, recoveryElapsed: 0,
    phase: 'none', hitDealt: false
  };

  private moveCooldowns: Map<string, number> = new Map();
  private selectedSlot = 0;
  private dodgeCooldown = 0;
  private dodgeActive   = false;
  private dodgeElapsed  = 0;
  private hurtElapsed   = 0;
  private guardActive   = false;

  private jumpPhase: 'none' | 'takeoff' | 'air' | 'landing' = 'none';
  private landingTimer = 0;

  projectileGroup: Phaser.Physics.Arcade.Group;
  onProjectileFired?: (p: Projectile) => void;
  activeHitbox?: { x: number; y: number; w: number; h: number } | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    data: MinariData,
    isPlayer: boolean,
    projectileGroup: Phaser.Physics.Arcade.Group
  ) {
    super(scene, x, y);
    this.fighterId       = data.id;
    this.isPlayer        = isPlayer;
    this.minariData      = data;
    this.stats           = { ...data.stats };
    this.facing          = isPlayer ? 1 : -1;
    this.projectileGroup = projectileGroup;

    // Shadow — kept in world-space, not parented to container
    this.shadow = scene.add.ellipse(0, 0, data.bodyWidth * 1.5, 14, 0x000000, 0.3);
    scene.add.existing(this.shadow);

    // Attempt to use a real sprite for Flarepaw
    const animMode  = scene.registry.get('flarepaw_anim_mode') as string | undefined;
    const spriteKey = scene.registry.get('flarepaw_sprite_key') as string | undefined;

    if (data.id === 'flarepaw' && spriteKey && animMode !== 'none') {
      this.sprite    = scene.add.sprite(0, 0, spriteKey);
      this.useSprite = true;

      // Scale to DISPLAY_HEIGHT; use bottom-centre origin so feet track the body
      this.sprite.setScale(SPRITE_SCALE);
      // setOrigin(0.5, 1) → pivot at bottom-centre of the frame.
      // We then shift it up by bodyHeight/2 so that the sprite's feet land
      // at the bottom edge of the physics body.
      this.sprite.setOrigin(0.5, 1);
      this.sprite.setPosition(0, data.bodyHeight / 2);
      this.sprite.setAlpha(1);

      // Antialiasing ON — this is an HD 2.5D game
      this.sprite.setTexture(spriteKey);

      this.add(this.sprite);
    }

    // Placeholder graphics (always created; hidden when real sprite is present)
    const glowCircle = scene.add.arc(0, 0, data.bodyWidth * 0.9, 0, 360, false, data.colorPrimary, 0.12);
    this.add(glowCircle);
    this.body_gfx = scene.add.graphics();
    this.add(this.body_gfx);

    if (this.useSprite) {
      glowCircle.setVisible(false);
      this.body_gfx.setVisible(false);
    } else {
      this.drawBody(false);
    }

    scene.add.existing(this);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    this.phBody = this.body as Phaser.Physics.Arcade.Body;
    this.phBody.setCollideWorldBounds(true);
    this.phBody.setGravityY(600);
    this.phBody.setSize(data.bodyWidth, data.bodyHeight);
    this.phBody.setOffset(-data.bodyWidth / 2, -data.bodyHeight / 2);
    this.phBody.setMaxVelocityX(data.stats.speed * 2.5);

    this.formSystem = new FormSystem(scene);
    if (data.abilityId && FORMS[data.abilityId]) {
      this.formSystem.setFormData(FORMS[data.abilityId]);
    }

    this.setDepth(10);
  }

  // ── Placeholder body drawing ───────────────────────────────────────────────

  private drawBody(inForm: boolean): void {
    const g  = this.body_gfx;
    g.clear();
    const d  = this.minariData;
    const bw = d.bodyWidth, bh = d.bodyHeight;
    const primary   = inForm ? this.formSystem.glowColor : d.colorPrimary;
    const secondary = d.colorSecondary;

    g.fillStyle(primary, 1);
    if (d.bodyShape === 'circle') g.fillCircle(0, 0, bw / 2);
    else g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);

    g.fillStyle(secondary, 0.8);
    if (d.bodyShape === 'circle') g.fillCircle(0, -4, bw / 4);
    else g.fillRoundedRect(-bw / 4, -bh / 2, bw / 2, bh / 3, 4);

    const eyeY = d.bodyShape === 'circle' ? -4 : -bh / 4;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, eyeY, 4); g.fillCircle(16, eyeY, 4);
    g.fillStyle(0x111111, 1);
    g.fillCircle(9, eyeY, 2); g.fillCircle(17, eyeY, 2);
  }

  // ── Animation playback ─────────────────────────────────────────────────────

  private playAnim(key: string, forceRestart = false): void {
    if (!this.sprite) return;
    if (!this.scene.anims.exists(key)) return;
    if (!forceRestart && this.lastAnim === key && this.sprite.anims.isPlaying) return;
    this.lastAnim = key;
    this.sprite.play(key, true);
  }

  private syncAnim(): void {
    if (!this.sprite) return;

    // Frames are authored right-facing; flip sprite (not container) when facing left
    this.sprite.setFlipX(this.facing === -1);

    const velX = Math.abs(this.phBody.velocity.x);

    switch (this.state) {
      case 'jump':
      case 'fall':
        // Phase-based: takeoff frames once, then hold air frame
        if (this.jumpPhase === 'air') {
          this.playAnim('flarepaw_jump_air', false);
        } else {
          this.playAnim('flarepaw_jump_takeoff', false);
        }
        break;
      case 'run':
        this.playAnim('flarepaw_run');
        break;
      case 'guard':
        if (this.flameGuardActive) {
          this.playAnim('flarepaw_flame_guard', false);
        } else {
          this.playAnim('flarepaw_guard', false);
        }
        break;
      case 'attacking':
        if (this.scene.anims.exists('flarepaw_attack')) {
          this.playAnim('flarepaw_attack', false);
        } else {
          this.playAnim('flarepaw_idle');
        }
        break;
      case 'hurt':
        break;
      case 'idle':
      case 'form_active':
      default:
        // Landing frame briefly overrides idle/run after touching down
        if (this.jumpPhase === 'landing') {
          this.playAnim('flarepaw_jump_land', false);
        } else if (velX > 10) {
          this.playAnim('flarepaw_run');
        } else {
          this.playAnim('flarepaw_idle');
        }
        break;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  get specials(): MoveData[] {
    return this.minariData.specialSlots.map(id => MOVES[id]).filter(Boolean);
  }
  get selectedSpecial(): MoveData | null { return this.specials[this.selectedSlot] ?? null; }
  selectSlot(i: number): void {
    if (i >= 0 && i < this.specials.length) this.selectedSlot = i;
  }
  get selectedSlotIndex(): number { return this.selectedSlot; }
  get isGrounded():    boolean { return this.grounded; }
  get isGuarding():    boolean { return this.guardActive; }
  get isDodging():     boolean { return this.dodgeActive; }
  get hasFlameGuard(): boolean { return this.flameGuardActive; }

  startCoreAttack(): boolean {
    if (this.attackState.active || this.state === 'hurt' || this.state === 'stunned') return false;
    const ca = CORE_ATTACKS[this.minariData.coreAttackId];
    if (!ca) return false;

    const now      = this.scene.time.now;
    const inWindow = (now - this.attackState.lastComboTime) < ca.comboWindow;
    const nextIdx  = inWindow ? (this.attackState.comboIndex + 1) % ca.comboHits.length : 0;

    this.attackState = {
      active: true, comboIndex: nextIdx, lastComboTime: now,
      startupElapsed: 0, activeElapsed: 0, recoveryElapsed: 0,
      phase: 'startup', hitDealt: false
    };
    this.state = 'attacking';
    return true;
  }

  startSpecial(moveId: string): boolean {
    const move = MOVES[moveId];
    if (!move) return false;
    if (this.stats.aura < move.auraCost) return false;
    if ((this.moveCooldowns.get(moveId) ?? 0) > 0) return false;
    if (this.attackState.active) return false;
    if (this.state === 'hurt' || this.state === 'stunned') return false;

    this.stats.aura -= move.auraCost;
    this.moveCooldowns.set(moveId, move.cooldown);

    if (moveId === 'flame_guard') {
      this.activateFlameGuard(move.buffDuration ?? 2000);
      this.state = 'guard';
      return true;
    }

    if (move.category === 'projectile') {
      this.fireProjectile(move);
      this.state = 'special';
      this.attackState = {
        active: true, comboIndex: 0, lastComboTime: 0,
        startupElapsed: 0, activeElapsed: 0, recoveryElapsed: 0,
        phase: 'startup', hitDealt: false
      };
      return true;
    }

    if (move.category === 'buff') {
      this.scene.time.delayedCall(move.buffDuration ?? 2000, () => {
        if (this.state === 'special') this.state = 'idle';
      });
      this.state = 'special';
      return true;
    }

    if (move.id === 'blaze_charge') {
      this.phBody.setVelocityX(this.facing * 600);
      this.scene.time.delayedCall(200, () => this.phBody.setVelocityX(0));
    }

    this.attackState = {
      active: true, comboIndex: 0, lastComboTime: 0,
      startupElapsed: 0, activeElapsed: 0, recoveryElapsed: 0,
      phase: 'startup', hitDealt: false
    };
    this.state = 'special';
    return true;
  }

  // Flame Guard ─────────────────────────────────────────────────────────────

  private activateFlameGuard(duration: number): void {
    this.flameGuardActive = true;
    this.flameGuardTimer  = duration;

    if (!this.flameGuardGfx) {
      this.flameGuardGfx = this.scene.add.graphics();
      this.add(this.flameGuardGfx);
    }
    this.flameGuardGfx.setVisible(true);
    this.flameGuardGfx.setDepth(20);

    const g = this.flameGuardGfx;
    g.clear();
    const r = this.minariData.bodyWidth * 1.2;
    g.lineStyle(4, 0xff8800, 0.95);
    g.strokeCircle(0, 0, r);
    g.fillStyle(0xff4400, 0.18);
    g.fillCircle(0, 0, r);
    g.lineStyle(2, 0xffcc00, 0.6);
    g.strokeCircle(0, 0, r * 0.7);

    this.scene.tweens.add({
      targets: this.flameGuardGfx, alpha: 0.4,
      duration: 280, yoyo: true, repeat: -1
    });
  }

  deactivateFlameGuard(): void {
    if (!this.flameGuardActive) return;
    this.flameGuardActive = false;
    this.flameGuardTimer  = 0;
    if (this.flameGuardGfx) {
      this.scene.tweens.killTweensOf(this.flameGuardGfx);
      this.flameGuardGfx.setVisible(false);
    }
    if (this.state === 'guard') this.state = 'idle';
  }

  // ──────────────────────────────────────────────────────────────────────────

  startDodge(): boolean {
    if (this.dodgeCooldown > 0 || this.state === 'hurt' || this.state === 'stunned') return false;
    this.dodgeActive   = true;
    this.dodgeElapsed  = 0;
    this.dodgeCooldown = 800;
    this.phBody.setVelocityX(this.facing * -350);
    this.state = 'dodge';
    return true;
  }

  activateForm(): boolean {
    if (!this.formSystem.canActivate(this.stats)) return false;
    if (this.formSystem.activate(this.stats)) {
      this.state = 'form_active';
      if (!this.useSprite) this.drawBody(true);
      return true;
    }
    return false;
  }

  useUltimate(): boolean {
    const ult = ULTIMATES[this.minariData.ultimateId];
    if (!ult || this.stats.soulbond < ult.soulbondCost) return false;
    this.stats.soulbond = 0;
    return true;
  }

  /** Returns burn counter-damage (>0) when Flame Guard is active and it's not already a burn hit. */
  takeDamage(amount: number, burnSource = false): number {
    const defense = this.stats.defense * this.formSystem.defenseMult;
    let reduced   = Math.max(1, amount - defense * 0.1);

    if (this.flameGuardActive && !burnSource) reduced *= 0.4;
    if (this.guardActive && !this.flameGuardActive) reduced *= 0.3;

    this.stats.hp = Math.max(0, this.stats.hp - reduced);
    this.stats.soulbond = Math.min(this.stats.maxSoulbond, this.stats.soulbond + reduced * 0.2);

    if (!this.guardActive) {
      this.state       = 'hurt';
      this.hurtElapsed = 0;
      this.attackState.active = false;
      this.attackState.phase  = 'none';
      this.phBody.setVelocityX(this.facing * -200);
    }

    // Flash red briefly
    const flashTarget = this.sprite ?? this.body_gfx;
    this.scene.tweens.killTweensOf(flashTarget);
    this.scene.tweens.add({
      targets: flashTarget, alpha: 0.15,
      duration: 60, yoyo: true, repeat: 3,
      onComplete: () => flashTarget.setAlpha(1)
    });

    return (this.flameGuardActive && !burnSource) ? 8 : 0;
  }

  private fireProjectile(move: MoveData): void {
    const p = this.projectileGroup.get() as Projectile | undefined;
    if (!p) return;
    const speed  = move.projectileSpeed ?? 350;
    const startX = this.x + this.facing * (this.minariData.bodyWidth / 2 + 10);
    const dmg    = move.damage * (this.formSystem.isActive ? this.formSystem.damageMult : 1);
    p.fire(startX, this.y, this.facing * speed, 0, dmg, this.fighterId, move.colorTint, 14);
    this.onProjectileFired?.(p);
  }

  // ── Per-frame update ───────────────────────────────────────────────────────

  update(delta: number): void {
    // Cooldowns
    this.moveCooldowns.forEach((cd, key) => this.moveCooldowns.set(key, Math.max(0, cd - delta)));
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);

    // Ground check
    this.grounded = this.phBody.blocked.down;

    // Form system
    this.formSystem.update(delta, this.stats);
    if (!this.formSystem.isActive && this.state === 'form_active') {
      this.state = 'idle';
      if (!this.useSprite) this.drawBody(false);
    }

    // Flame Guard timer
    if (this.flameGuardActive) {
      this.flameGuardTimer -= delta;
      if (this.flameGuardTimer <= 0) this.deactivateFlameGuard();
    }

    // Dodge resolution
    if (this.dodgeActive) {
      this.dodgeElapsed += delta;
      if (this.dodgeElapsed >= 250) {
        this.dodgeActive = false;
        if (this.state === 'dodge') this.state = 'idle';
      }
    }

    // Hurt recovery
    if (this.state === 'hurt') {
      this.hurtElapsed += delta;
      if (this.hurtElapsed >= 350) this.state = 'idle';
    }

    // Attack frame phases
    if (this.attackState.active) {
      const ca  = CORE_ATTACKS[this.minariData.coreAttackId];
      const hit = ca?.comboHits[this.attackState.comboIndex];
      if (!hit) {
        this.attackState.active = false;
        this.attackState.phase  = 'none';
        if (this.state === 'attacking') this.state = 'idle';
      } else {
        const spf = 1000 / 60;
        if (this.attackState.phase === 'startup') {
          this.attackState.startupElapsed += delta;
          if (this.attackState.startupElapsed >= hit.startupFrames * spf) {
            this.attackState.phase         = 'active';
            this.attackState.activeElapsed = 0;
            this.activeHitbox = {
              x: this.x + this.facing * hit.hitbox.offsetX,
              y: this.y + hit.hitbox.offsetY,
              w: hit.hitbox.width, h: hit.hitbox.height
            };
          }
        } else if (this.attackState.phase === 'active') {
          this.attackState.activeElapsed += delta;
          if (this.attackState.activeElapsed >= hit.activeFrames * spf) {
            this.attackState.phase           = 'recovery';
            this.attackState.recoveryElapsed = 0;
            this.activeHitbox = null;
          }
        } else if (this.attackState.phase === 'recovery') {
          this.attackState.recoveryElapsed += delta;
          if (this.attackState.recoveryElapsed >= hit.recoveryFrames * spf) {
            this.attackState.active = false;
            this.attackState.phase  = 'none';
            if (this.state === 'attacking' || this.state === 'special') this.state = 'idle';
          }
        }
      }
    }

    // Jump / fall state tracking + phase-based jump animation management
    if (!this.grounded && this.state !== 'attacking' && this.state !== 'hurt' &&
        this.state !== 'stunned' && this.state !== 'guard') {
      // Leaving ground: start takeoff phase
      if (this.jumpPhase === 'none' || this.jumpPhase === 'landing') {
        this.jumpPhase = 'takeoff';
      }
      // Takeoff animation finished → switch to air-hold frame
      if (this.jumpPhase === 'takeoff' && this.sprite &&
          !this.sprite.anims.isPlaying && this.lastAnim === 'flarepaw_jump_takeoff') {
        this.jumpPhase = 'air';
      }
      this.state = this.phBody.velocity.y < 0 ? 'jump' : 'fall';
    } else if (this.grounded) {
      // Just touched down from a jump
      if ((this.state === 'jump' || this.state === 'fall') &&
          (this.jumpPhase === 'takeoff' || this.jumpPhase === 'air')) {
        this.jumpPhase   = 'landing';
        this.landingTimer = 100;
      }
      // Count down the brief landing hold
      if (this.jumpPhase === 'landing') {
        this.landingTimer -= delta;
        if (this.landingTimer <= 0) this.jumpPhase = 'none';
      }
      // Resolve ground state
      if (this.state === 'jump' || this.state === 'fall') {
        this.state = Math.abs(this.phBody.velocity.x) > 10 ? 'run' : 'idle';
      } else if (this.state === 'idle' && Math.abs(this.phBody.velocity.x) > 10) {
        this.state = 'run';
      } else if (this.state === 'run' && Math.abs(this.phBody.velocity.x) <= 10) {
        this.state = 'idle';
      }
    }

    this.guardActive = this.state === 'guard';

    // Aura regen
    if (this.state !== 'special' && !this.formSystem.isActive) {
      this.stats.aura = Math.min(this.stats.maxAura, this.stats.aura + 6 * delta / 1000);
    }
    if (this.state === 'attacking') {
      this.stats.soulbond = Math.min(this.stats.maxSoulbond, this.stats.soulbond + 1 * delta / 1000);
    }

    // Shadow — world-space tracking
    this.shadow.setPosition(this.x, this.y + this.minariData.bodyHeight / 2 + 5);

    // Container scaleX stays 1 — facing is handled by sprite.setFlipX only
    // (Prevents container-level mirror which would flip UI gfx and flame guard ring)
    this.scaleX = 1;

    // Sync animation + flip
    this.syncAnim();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getCurrentAttackHit() {
    if (!this.attackState.active || this.attackState.phase !== 'active' || this.attackState.hitDealt) return null;
    const ca = CORE_ATTACKS[this.minariData.coreAttackId];
    return ca?.comboHits[this.attackState.comboIndex] ?? null;
  }

  markHitDealt():    void    { this.attackState.hitDealt = true; }
  isAttackActive():  boolean { return this.attackState.active && this.attackState.phase === 'active'; }
  isInCooldown(id: string): boolean { return (this.moveCooldowns.get(id) ?? 0) > 0; }
  isDead():          boolean { return this.stats.hp <= 0; }
  isFormReady():     boolean { return this.formSystem.canActivate(this.stats); }
  isUltimateReady(): boolean {
    const ult = ULTIMATES[this.minariData.ultimateId];
    return ult ? this.stats.soulbond >= ult.soulbondCost : false;
  }
  get flameGuardTimeRemaining(): number { return this.flameGuardTimer; }

  // Debug info string for the overlay
  debugInfo(): string {
    return [
      `state:${this.state}`,
      `anim:${this.lastAnim}`,
      `face:${this.facing === 1 ? 'R' : 'L'}`,
      `gnd:${this.grounded ? 'Y' : 'N'}`,
      `hp:${Math.round(this.stats.hp)}/${this.stats.maxHp}`,
      `aura:${Math.round(this.stats.aura)}`,
      `sb:${Math.round(this.stats.soulbond)}`,
      `sprite:${this.useSprite ? 'yes' : 'gfx'}`,
    ].join('  ');
  }

  override destroy(): void {
    this.shadow.destroy();
    super.destroy();
  }
}
