import type Phaser from 'phaser';
import type { ClassicBattlePhase, PendingAction, ClassicActorRole, EngineCallbacks, ClassicMoveConfig } from '../types/classic';
import { ClassicActor } from '../entities/ClassicActor';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS } from '../data/classicMoveData';
import { COMBAT_FORMULA, TYPE_CHART } from '../config/classicBattleConfig';

const PLAYER_ANCHOR_X = 200;
const ENEMY_ANCHOR_X  = 760;
const CONTACT_OFFSET  = 100;  // px from the target's centre where the attacker stops
const APPROACH_SPEED  = 380;  // px/s

// Aura gains per action type
const AURA_GAIN_ATTACK = 10;
const AURA_GAIN_OTHER  = 5;

export class ClassicBattleEngine {
  private phase: ClassicBattlePhase = 'battle_intro';
  private actionQueue: PendingAction[] = [];
  private busy = false;

  private readonly scene:     Phaser.Scene;
  private readonly player:    ClassicActor;
  private readonly enemy:     ClassicActor;
  private readonly callbacks: EngineCallbacks;

  constructor(
    scene:     Phaser.Scene,
    player:    ClassicActor,
    enemy:     ClassicActor,
    callbacks: EngineCallbacks,
  ) {
    this.scene     = scene;
    this.player    = player;
    this.enemy     = enemy;
    this.callbacks = callbacks;
  }

  get currentPhase(): ClassicBattlePhase { return this.phase; }

  /** Call once (after any intro animation) to begin the first turn. */
  startBattle(): void {
    this.player.playAnim('idle');
    this.enemy.playAnim('idle');
    this.openCommandMenu();
  }

  /** Call when the player picks a command from the move menu. */
  submitPlayerMove(moveId: string): void {
    if (this.phase !== 'player_command') return;
    this.callbacks.onHideCommandMenu();
    this.actionQueue = [
      { role: 'player', moveId },
      { role: 'enemy',  moveId: this.selectEnemyMove() },
    ];
    this.setPhase('action_queue');
    this.executeNextAction();
  }

  /**
   * Call when the player attempts a capture but the ball escapes.
   * The enemy still gets to act this turn; the player's turn is wasted.
   */
  submitCaptureFailed(): void {
    if (this.phase !== 'player_command') return;
    this.callbacks.onHideCommandMenu();
    this.actionQueue = [
      { role: 'enemy', moveId: this.selectEnemyMove() },
    ];
    this.setPhase('action_queue');
    this.executeNextAction();
  }

  /**
   * Called on a successful capture — enemy concedes immediately.
   * The battle ends as a player victory without further combat.
   */
  forfeit(): void {
    this.releaseGuardStances();
    this.setPhase('victory');
    this.callbacks.onBattleEnd('player');
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private openCommandMenu(): void {
    this.setPhase('player_command');
    this.callbacks.onShowCommandMenu();
  }

  private setPhase(p: ClassicBattlePhase): void {
    this.phase = p;
    this.callbacks.onPhaseChange(p);
  }

  private selectEnemyMove(): string {
    const moves = CLASSIC_COMMAND_SETS[this.enemy.actorId] ?? ['basic_attack'];
    return moves[Math.floor(Math.random() * moves.length)];
  }

  private executeNextAction(): void {
    if (this.busy || this.actionQueue.length === 0) return;
    this.busy = true;

    const action   = this.actionQueue.shift()!;
    const attacker = action.role === 'player' ? this.player : this.enemy;
    const defender  = action.role === 'player' ? this.enemy  : this.player;
    const move     = CLASSIC_MOVES[action.moveId];

    if (!move) {
      this.busy = false;
      this.afterAction();
      return;
    }

    // Deduct aura cost (clamp at 0 — engine allows executing even if broke)
    const auraCost = move.auraCost ?? 0;
    if (auraCost > 0) {
      attacker.aura = Math.max(0, attacker.aura - auraCost);
    }

    const anchorX  = action.role === 'player' ? PLAYER_ANCHOR_X : ENEMY_ANCHOR_X;
    const contactX = action.role === 'player'
      ? defender.x - CONTACT_OFFSET
      : defender.x + CONTACT_OFFSET;

    // ── Guard / stance-hold moves ───────────────────────────────────────────
    if (move.holdsStance) {
      this.setPhase('perform_action');
      attacker.playAnim(move.animFolder, true);
      attacker.isGuarding = true;
      this.gainAura(attacker, AURA_GAIN_OTHER);
      this.busy = false;
      this.afterAction();
      return;
    }

    // ── Non-stance stay moves (buffs, etc.) ────────────────────────────────
    if (move.movementType === 'stay') {
      this.setPhase('perform_action');
      attacker.playAnim(move.animFolder, true);
      this.scene.time.delayedCall(700, () => {
        attacker.playAnim('idle');
        this.gainAura(attacker, AURA_GAIN_OTHER);
        this.busy = false;
        this.afterAction();
      });
      return;
    }

    // ── Dash-to-target moves ───────────────────────────────────────────────
    this.setPhase('approach_target');
    attacker.setFacing(action.role === 'player' ? 1 : -1);
    attacker.playAnim(move.approachAnim);

    this.scene.tweens.add({
      targets:  attacker,
      x:        contactX,
      duration: this.travelMs(attacker.x, contactX),
      ease:     'Linear',
      onComplete: () => {
        // ── Perform action ───────────────────────────────────────────────
        this.setPhase('perform_action');
        attacker.playAnim(move.animFolder, true);

        const animKey  = `${attacker.actorId}_${move.animFolder}`;
        const animData = this.scene.anims.get(animKey);
        const hitMs    = animData
          ? (1000 / (animData.frameRate || 12)) * (move.hitFrameIndex + 1)
          : 200;

        this.scene.time.delayedCall(hitMs, () => {
          // ── Apply hit ───────────────────────────────────────────────
          this.setPhase('apply_hit');

          const isBlocked = defender.isGuarding && move.power > 0;
          const targetRole: ClassicActorRole = action.role === 'player' ? 'enemy' : 'player';

          if (move.power > 0) {
            const { damage: dmg, isCrit, typeAdvantage } = this.calcDamage(
              attacker, defender, move, action.role,
            );
            defender.hp = Math.max(0, defender.hp - dmg);
            this.callbacks.onDamageDealt(targetRole, dmg, isBlocked, defender.x, defender.y - 40);
            this.callbacks.onHitMeta?.(targetRole, { isCrit, typeAdvantage });
            if (!isBlocked) defender.flashDamage();
          }

          // Aura gain for attacker after landing an attack
          this.gainAura(attacker, AURA_GAIN_ATTACK);

          // ── Target reaction ─────────────────────────────────────────
          this.setPhase('target_reaction');
          if (move.targetReaction === 'hurt' && !isBlocked) {
            defender.playAnim('hurt', true);
            this.scene.time.delayedCall(350, () => {
              if (!defender.isGuarding) defender.playAnim('idle');
            });
          }

          // ── Return to anchor ────────────────────────────────────────
          this.scene.time.delayedCall(500, () => {
            if (move.returnToAnchor) {
              this.setPhase('return_to_anchor');
              attacker.setFacing(action.role === 'player' ? -1 : 1);
              attacker.playAnim(move.returnAnim);

              this.scene.tweens.add({
                targets:  attacker,
                x:        anchorX,
                duration: this.travelMs(attacker.x, anchorX),
                ease:     'Linear',
                onComplete: () => {
                  attacker.setFacing(action.role === 'player' ? 1 : -1);
                  attacker.playAnim('idle');
                  this.busy = false;
                  this.afterAction();
                },
              });
            } else {
              attacker.playAnim('idle');
              this.busy = false;
              this.afterAction();
            }
          });
        });
      },
    });
  }

  private afterAction(): void {
    if (this.enemy.hp <= 0) {
      this.releaseGuardStances();
      this.setPhase('victory');
      this.callbacks.onBattleEnd('player');
      return;
    }
    if (this.player.hp <= 0) {
      this.releaseGuardStances();
      this.setPhase('defeat');
      this.callbacks.onBattleEnd('enemy');
      return;
    }

    if (this.actionQueue.length > 0) {
      this.scene.time.delayedCall(400, () => {
        this.setPhase('action_queue');
        this.executeNextAction();
      });
    } else {
      this.releaseGuardStances();
      this.setPhase('turn_end');
      this.scene.time.delayedCall(600, () => this.openCommandMenu());
    }
  }

  private releaseGuardStances(): void {
    for (const actor of [this.player, this.enemy]) {
      if (actor.isGuarding) {
        actor.isGuarding = false;
        actor.playAnim('idle');
      }
    }
  }

  private gainAura(actor: ClassicActor, amount: number): void {
    actor.aura = Math.min(actor.maxAura, actor.aura + amount);
  }

  private travelMs(fromX: number, toX: number): number {
    return Math.max(150, (Math.abs(toX - fromX) / APPROACH_SPEED) * 1000);
  }

  private calcDamage(
    attacker:    ClassicActor,
    defender:    ClassicActor,
    move:        ClassicMoveConfig,
    attackerRole: ClassicActorRole,
  ): { damage: number; isCrit: boolean; typeAdvantage: boolean } {
    const {
      LEVEL_GROWTH_RATE, POWER_SCALE_BASE, DEF_SCALE_BASE,
      VARIANCE_MIN, VARIANCE_MAX, CRIT_BASE_CHANCE, CRIT_DAMAGE_MULT, GUARD_RETAIN,
    } = COMBAT_FORMULA;

    // Level scaling: each level adds LEVEL_GROWTH_RATE to the stat multiplier
    const atkLvlMult = 1 + LEVEL_GROWTH_RATE * (attacker.combatLevel - 1);
    const defLvlMult = 1 + LEVEL_GROWTH_RATE * (defender.combatLevel - 1);
    const atkPow     = attacker.minariData.stats.power   * atkLvlMult;
    const defStat    = defender.minariData.stats.defense * defLvlMult;

    // Type advantage
    const typeMult    = TYPE_CHART[move.damageType]?.[defender.minariData.element] ?? 1.0;
    const typeAdvantage = typeMult > 1.0;

    // Critical hit (base chance + Soul Sync bonus)
    const critBonus = this.callbacks.getCritBonus?.(attackerRole) ?? 0;
    const isCrit    = Math.random() < Math.max(0, CRIT_BASE_CHANCE + critBonus);
    const critMult  = isCrit ? CRIT_DAMAGE_MULT : 1.0;

    // Damage roll
    const variance = VARIANCE_MIN + Math.random() * (VARIANCE_MAX - VARIANCE_MIN);
    let dmg = Math.round(
      move.power
      * (atkPow  / POWER_SCALE_BASE)
      * (DEF_SCALE_BASE / defStat)
      * typeMult
      * critMult
      * variance,
    );

    if (defender.isGuarding) dmg = Math.round(dmg * GUARD_RETAIN);
    return { damage: Math.max(1, dmg), isCrit, typeAdvantage };
  }
}
