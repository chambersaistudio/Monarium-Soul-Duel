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

export class MinariFighter extends Phaser.GameObjects.Container {
  readonly fighterId: string;
  readonly isPlayer: boolean;
  stats: FighterStats;
  minariData: MinariData;
  facing: 1 | -1;

  private body_gfx: Phaser.GameObjects.Graphics;
  private shadow: Phaser.GameObjects.Ellipse;

  state: FighterState = 'idle';
  formSystem: FormSystem;

  private phBody!: Phaser.Physics.Arcade.Body;
  private grounded: boolean = false;

  private attackState: AttackState = {
    active: false, comboIndex: 0, lastComboTime: 0,
    startupElapsed: 0, activeElapsed: 0, recoveryElapsed: 0,
    phase: 'none', hitDealt: false
  };

  private moveCooldowns: Map<string, number> = new Map();
  private selectedSlot: number = 0;
  private dodgeCooldown: number = 0;
  private dodgeActive: boolean = false;
  private dodgeElapsed: number = 0;
  private hurtElapsed: number = 0;
  private guardActive: boolean = false;

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
    this.fighterId = data.id;
    this.isPlayer = isPlayer;
    this.minariData = data;
    this.stats = { ...data.stats };
    this.facing = isPlayer ? 1 : -1;
    this.projectileGroup = projectileGroup;

    // Shadow
    this.shadow = scene.add.ellipse(0, data.bodyHeight / 2 + 4, data.bodyWidth * 1.2, 14, 0x000000, 0.3);
    this.shadow.setDepth(-1);
    scene.add.existing(this.shadow);

    // Glow
    const glowCircle = scene.add.arc(0, 0, data.bodyWidth * 0.8, 0, 360, false, data.colorPrimary, 0.15);
    this.add(glowCircle);

    // Body shape
    this.body_gfx = scene.add.graphics();
    this.add(this.body_gfx);
    this.drawBody(false);

    scene.add.existing(this);
    scene.physics.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    this.phBody = this.body as Phaser.Physics.Arcade.Body;
    this.phBody.setCollideWorldBounds(true);
    this.phBody.setGravityY(600);
    this.phBody.setSize(data.bodyWidth, data.bodyHeight);
    this.phBody.setOffset(-data.bodyWidth / 2, -data.bodyHeight / 2);
    this.phBody.setMaxVelocityX(data.stats.speed * 2.5);

    this.formSystem = new FormSystem(scene);
    const formId = data.abilityId;
    if (formId && FORMS[formId]) {
      this.formSystem.setFormData(FORMS[formId]);
    }

    this.setDepth(10);
  }

  private drawBody(inForm: boolean): void {
    const g = this.body_gfx;
    g.clear();
    const d = this.minariData;
    const w = d.bodyWidth;
    const h = d.bodyHeight;
    const primary = inForm ? this.formSystem.glowColor : d.colorPrimary;
    const secondary = d.colorSecondary;

    g.fillStyle(primary, 1);
    if (d.bodyShape === 'circle') {
      g.fillCircle(0, 0, w / 2);
    } else {
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    }

    g.fillStyle(secondary, 0.8);
    if (d.bodyShape === 'circle') {
      g.fillCircle(0, -4, w / 4);
    } else {
      g.fillRoundedRect(-w / 4, -h / 2, w / 2, h / 3, 4);
    }

    // Eyes
    const eyeY = d.bodyShape === 'circle' ? -4 : -h / 4;
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, eyeY, 4);
    g.fillCircle(16, eyeY, 4);
    g.fillStyle(0x111111, 1);
    g.fillCircle(9, eyeY, 2);
    g.fillCircle(17, eyeY, 2);
  }

  get specials(): MoveData[] {
    return this.minariData.specialSlots.map(id => MOVES[id]).filter(Boolean);
  }

  get selectedSpecial(): MoveData | null {
    return this.specials[this.selectedSlot] ?? null;
  }

  selectSlot(i: number): void {
    if (i >= 0 && i < this.specials.length) this.selectedSlot = i;
  }

  get selectedSlotIndex(): number { return this.selectedSlot; }
  get isGrounded(): boolean { return this.grounded; }
  get isGuarding(): boolean { return this.guardActive; }
  get isDodging(): boolean { return this.dodgeActive; }

  startCoreAttack(): boolean {
    if (this.attackState.active || this.state === 'hurt' || this.state === 'stunned') return false;
    const ca = CORE_ATTACKS[this.minariData.coreAttackId];
    if (!ca) return false;

    const now = this.scene.time.now;
    const inWindow = (now - this.attackState.lastComboTime) < ca.comboWindow;
    const nextIdx = inWindow ? (this.attackState.comboIndex + 1) % ca.comboHits.length : 0;

    this.attackState = {
      active: true,
      comboIndex: nextIdx,
      lastComboTime: now,
      startupElapsed: 0,
      activeElapsed: 0,
      recoveryElapsed: 0,
      phase: 'startup',
      hitDealt: false
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
      this.scene.time.delayedCall(200, () => {
        this.phBody.setVelocityX(0);
      });
    }

    this.attackState = {
      active: true, comboIndex: 0, lastComboTime: 0,
      startupElapsed: 0, activeElapsed: 0, recoveryElapsed: 0,
      phase: 'startup', hitDealt: false
    };
    this.state = 'special';
    return true;
  }

  startDodge(): boolean {
    if (this.dodgeCooldown > 0 || this.state === 'hurt' || this.state === 'stunned') return false;
    this.dodgeActive = true;
    this.dodgeElapsed = 0;
    this.dodgeCooldown = 800;
    this.phBody.setVelocityX(this.facing * -350);
    this.state = 'dodge';
    return true;
  }

  activateForm(): boolean {
    if (!this.formSystem.canActivate(this.stats)) return false;
    if (this.formSystem.activate(this.stats)) {
      this.state = 'form_active';
      this.drawBody(true);
      return true;
    }
    return false;
  }

  useUltimate(): boolean {
    const ultId = this.minariData.ultimateId;
    const ult = ULTIMATES[ultId];
    if (!ult) return false;
    if (this.stats.soulbond < ult.soulbondCost) return false;
    this.stats.soulbond = 0;
    return true;
  }

  takeDamage(amount: number): void {
    const defense = this.stats.defense * this.formSystem.defenseMult;
    const reduced = Math.max(1, amount - defense * 0.1);
    const actual = this.guardActive ? reduced * 0.3 : reduced;
    this.stats.hp = Math.max(0, this.stats.hp - actual);
    this.stats.soulbond = Math.min(this.stats.maxSoulbond, this.stats.soulbond + actual * 0.2);

    if (!this.guardActive) {
      this.state = 'hurt';
      this.hurtElapsed = 0;
      this.attackState.active = false;
      this.attackState.phase = 'none';
      this.phBody.setVelocityX(this.facing * -200);
    }

    this.scene.tweens.add({
      targets: this.body_gfx,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 2,
      onComplete: () => { this.body_gfx.setAlpha(1); }
    });
  }

  private fireProjectile(move: MoveData): void {
    const p = this.projectileGroup.get() as Projectile | undefined;
    if (!p) return;
    const speed = move.projectileSpeed ?? 350;
    const startX = this.x + this.facing * (this.minariData.bodyWidth / 2 + 10);
    const startY = this.y;
    const dmg = move.damage * (this.formSystem.isActive ? this.formSystem.damageMult : 1);
    p.fire(startX, startY, this.facing * speed, 0, dmg, this.fighterId, move.colorTint, 14);
    this.onProjectileFired?.(p);
  }

  update(delta: number): void {
    this.moveCooldowns.forEach((cd, key) => {
      this.moveCooldowns.set(key, Math.max(0, cd - delta));
    });
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - delta);

    this.grounded = this.phBody.blocked.down;

    this.formSystem.update(delta, this.stats);
    if (!this.formSystem.isActive && this.state === 'form_active') {
      this.state = 'idle';
      this.drawBody(false);
    }

    if (this.dodgeActive) {
      this.dodgeElapsed += delta;
      if (this.dodgeElapsed >= 250) {
        this.dodgeActive = false;
        if (this.state === 'dodge') this.state = 'idle';
      }
    }

    if (this.state === 'hurt') {
      this.hurtElapsed += delta;
      if (this.hurtElapsed >= 350) this.state = 'idle';
    }

    if (this.attackState.active) {
      const ca = CORE_ATTACKS[this.minariData.coreAttackId];
      const hit = ca?.comboHits[this.attackState.comboIndex];
      if (!hit) {
        this.attackState.active = false;
        this.attackState.phase = 'none';
        if (this.state === 'attacking') this.state = 'idle';
      } else {
        const spf = 1000 / 60;
        if (this.attackState.phase === 'startup') {
          this.attackState.startupElapsed += delta;
          if (this.attackState.startupElapsed >= hit.startupFrames * spf) {
            this.attackState.phase = 'active';
            this.attackState.activeElapsed = 0;
            this.activeHitbox = {
              x: this.x + this.facing * hit.hitbox.offsetX,
              y: this.y + hit.hitbox.offsetY,
              w: hit.hitbox.width,
              h: hit.hitbox.height
            };
          }
        } else if (this.attackState.phase === 'active') {
          this.attackState.activeElapsed += delta;
          if (this.attackState.activeElapsed >= hit.activeFrames * spf) {
            this.attackState.phase = 'recovery';
            this.attackState.recoveryElapsed = 0;
            this.activeHitbox = null;
          }
        } else if (this.attackState.phase === 'recovery') {
          this.attackState.recoveryElapsed += delta;
          if (this.attackState.recoveryElapsed >= hit.recoveryFrames * spf) {
            this.attackState.active = false;
            this.attackState.phase = 'none';
            if (this.state === 'attacking' || this.state === 'special') this.state = 'idle';
          }
        }
      }
    }

    // Aura regen
    if (this.state !== 'special' && !this.formSystem.isActive) {
      this.stats.aura = Math.min(this.stats.maxAura, this.stats.aura + 6 * delta / 1000);
    }

    if (this.state === 'attacking') {
      this.stats.soulbond = Math.min(this.stats.maxSoulbond, this.stats.soulbond + 1 * delta / 1000);
    }

    this.guardActive = this.state === 'guard';
    this.shadow.setPosition(this.x, this.y + this.minariData.bodyHeight / 2 + 4);

    // Flip by setting scaleX (flips the container and all children)
    this.scaleX = this.facing;
  }

  getCurrentAttackHit() {
    if (!this.attackState.active || this.attackState.phase !== 'active' || this.attackState.hitDealt) {
      return null;
    }
    const ca = CORE_ATTACKS[this.minariData.coreAttackId];
    return ca?.comboHits[this.attackState.comboIndex] ?? null;
  }

  markHitDealt(): void {
    this.attackState.hitDealt = true;
  }

  isAttackActive(): boolean {
    return this.attackState.active && this.attackState.phase === 'active';
  }

  isInCooldown(moveId: string): boolean {
    return (this.moveCooldowns.get(moveId) ?? 0) > 0;
  }

  isDead(): boolean { return this.stats.hp <= 0; }
  isFormReady(): boolean { return this.formSystem.canActivate(this.stats); }
  isUltimateReady(): boolean {
    const ult = ULTIMATES[this.minariData.ultimateId];
    return ult ? this.stats.soulbond >= ult.soulbondCost : false;
  }

  override destroy(): void {
    this.shadow.destroy();
    super.destroy();
  }
}
