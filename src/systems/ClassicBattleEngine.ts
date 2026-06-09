import type Phaser from 'phaser';
import type { ClassicBattlePhase, PendingAction, ClassicActorRole, EngineCallbacks, ClassicMoveConfig } from '../types/classic';
import { ClassicActor } from '../entities/ClassicActor';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS } from '../data/classicMoveData';
import { BattleCalculator } from './BattleCalculator';
import { MINARI_ROSTER } from '../data/minariData';

const PLAYER_ANCHOR_X = 200;
const ENEMY_ANCHOR_X  = 760;
const CONTACT_OFFSET  = 100;  // px from the target's centre where the attacker stops
const APPROACH_SPEED  = 380;  // px/s

const AURA_GAIN_ATTACK = 10;
const AURA_GAIN_GUARD  = 0;   // guard-specific aura comes from move.auraGain

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

  startBattle(): void {
    this.player.playAnim('idle');
    this.enemy.playAnim('idle');
    this.openCommandMenu();
  }

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

  submitCaptureFailed(): void {
    if (this.phase !== 'player_command') return;
    this.callbacks.onHideCommandMenu();
    this.actionQueue = [{ role: 'enemy', moveId: this.selectEnemyMove() }];
    this.setPhase('action_queue');
    this.executeNextAction();
  }

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
    const defender = action.role === 'player' ? this.enemy  : this.player;
    const move     = CLASSIC_MOVES[action.moveId];

    if (!move) {
      this.busy = false;
      this.afterAction();
      return;
    }

    // Announce move before anything else
    this.callbacks.onMoveAnnounce?.(action.role, move.id, move.displayName);

    // Deduct aura cost
    const auraCost = move.auraCost ?? 0;
    if (auraCost > 0) attacker.aura = Math.max(0, attacker.aura - auraCost);

    const anchorX  = action.role === 'player' ? PLAYER_ANCHOR_X : ENEMY_ANCHOR_X;
    const contactX = action.role === 'player'
      ? defender.x - CONTACT_OFFSET
      : defender.x + CONTACT_OFFSET;

    // ── Guard / stance-hold moves ─────────────────────────────────────────
    if (move.holdsStance) {
      this.setPhase('perform_action');
      attacker.playAnim(move.animFolder, true);
      attacker.isGuarding = true;
      this.gainAura(attacker, move.auraGain ?? AURA_GAIN_GUARD);
      this.busy = false;
      this.afterAction();
      return;
    }

    // ── Accuracy check (skip for 100% accurate moves) ─────────────────────
    const accuracy = move.accuracy ?? 100;
    if (accuracy < 100 && Math.random() * 100 >= accuracy) {
      this.callbacks.onMoveMiss?.(action.role, move.displayName);
      attacker.playAnim('idle');
      this.busy = false;
      this.afterAction();
      return;
    }

    // ── Non-stance stay moves (status / ranged attacks) ───────────────────
    if (move.movementType === 'stay') {
      this.setPhase('perform_action');
      attacker.playAnim(move.animFolder, true);
      this.scene.time.delayedCall(700, () => {
        // Apply sync damage if this is a status move with syncDamage
        if (move.syncDamage) {
          const targetRole: ClassicActorRole = action.role === 'player' ? 'enemy' : 'player';
          this.callbacks.onSyncDamage?.(targetRole, move.syncDamage);
        }
        // If move has damage (ranged / stay attack), apply it
        if (move.power > 0) {
          const targetRole: ClassicActorRole = action.role === 'player' ? 'enemy' : 'player';
          const isBlocked = defender.isGuarding;
          const { damage: dmg, isCrit, typeModifier, typeAdvantage, typeResisted } = this.calcDamageFull(attacker, defender, move, action.role);
          defender.hp = Math.max(0, defender.hp - dmg);
          this.callbacks.onDamageDealt(targetRole, dmg, isBlocked, defender.x, defender.y - 40);
          this.callbacks.onHitMeta?.(targetRole, { isCrit, typeModifier, typeAdvantage, typeResisted });
          if (!isBlocked) defender.flashDamage();
          this.gainAura(attacker, AURA_GAIN_ATTACK);
        }
        attacker.playAnim('idle');
        this.busy = false;
        this.afterAction();
      });
      return;
    }

    // ── Dash-to-target moves ──────────────────────────────────────────────
    this.setPhase('approach_target');
    attacker.setFacing(action.role === 'player' ? 1 : -1);
    attacker.playAnim(move.approachAnim);

    this.scene.tweens.add({
      targets:  attacker,
      x:        contactX,
      duration: this.travelMs(attacker.x, contactX),
      ease:     'Linear',
      onComplete: () => {
        this.setPhase('perform_action');
        attacker.playAnim(move.animFolder, true);

        const animKey  = `${attacker.actorId}_${move.animFolder}`;
        const animData = this.scene.anims.get(animKey);
        const hitMs    = animData
          ? (1000 / (animData.frameRate || 12)) * (move.hitFrameIndex + 1)
          : 200;

        this.scene.time.delayedCall(hitMs, () => {
          this.setPhase('apply_hit');

          const isBlocked  = defender.isGuarding && move.power > 0;
          const targetRole: ClassicActorRole = action.role === 'player' ? 'enemy' : 'player';

          if (move.power > 0) {
            const { damage: dmg, isCrit, typeModifier, typeAdvantage, typeResisted } = this.calcDamageFull(
              attacker, defender, move, action.role,
            );
            defender.hp = Math.max(0, defender.hp - dmg);
            this.callbacks.onDamageDealt(targetRole, dmg, isBlocked, defender.x, defender.y - 40);
            this.callbacks.onHitMeta?.(targetRole, { isCrit, typeModifier, typeAdvantage, typeResisted });
            if (!isBlocked) defender.flashDamage();
          }

          this.gainAura(attacker, AURA_GAIN_ATTACK);

          this.setPhase('target_reaction');
          if (move.targetReaction === 'hurt' && !isBlocked) {
            defender.playAnim('hurt', true);
            this.scene.time.delayedCall(350, () => {
              if (!defender.isGuarding) defender.playAnim('idle');
            });
          }

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

  private calcDamageFull(
    attacker:     ClassicActor,
    defender:     ClassicActor,
    move:         ClassicMoveConfig,
    attackerRole: ClassicActorRole,
  ): { damage: number; isCrit: boolean; typeModifier: number; typeAdvantage: boolean; typeResisted: boolean } {
    const syncTier = (this.callbacks.getSyncTier?.(attackerRole) ?? 'stable') as import('../types/progression').SoulSyncTier;
    const defenderElement = MINARI_ROSTER[defender.actorId]?.element ?? 'neutral';

    const result = BattleCalculator.calculate({
      attackerStats:    attacker.computedStats,
      defenderStats:    defender.computedStats,
      moveElement:      move.damageType,
      defenderElement,
      movePower:        move.power,
      moveCategory:     move.category,
      canCrit:          move.canCrit,
      attackerSyncTier: syncTier,
      defenderGuarding: defender.isGuarding,
    });

    return {
      damage:       result.damage,
      isCrit:       result.isCrit,
      typeModifier: result.typeModifier,
      typeAdvantage: result.typeAdvantage,
      typeResisted:  result.typeResisted,
    };
  }
}
