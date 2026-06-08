import type Phaser from 'phaser';
import type { ClassicBattlePhase, PendingAction, ClassicActorRole, EngineCallbacks } from '../types/classic';
import { ClassicActor } from '../entities/ClassicActor';
import { CLASSIC_MOVES, CLASSIC_COMMAND_SETS } from '../data/classicMoveData';

const PLAYER_ANCHOR_X  = 200;
const ENEMY_ANCHOR_X   = 760;
const CONTACT_OFFSET   = 100;  // px from the target's center where the attacker stops
const APPROACH_SPEED   = 380;  // px/s

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

  /** Call when the player picks a command from the menu. */
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

    const anchorX  = action.role === 'player' ? PLAYER_ANCHOR_X : ENEMY_ANCHOR_X;
    const contactX = action.role === 'player'
      ? defender.x - CONTACT_OFFSET
      : defender.x + CONTACT_OFFSET;

    if (move.movementType === 'dash_to_target') {
      this.setPhase('approach_target');
      attacker.setFacing(action.role === 'player' ? 1 : -1);
      attacker.playAnim(move.approachAnim);

      const approachMs = this.travelMs(attacker.x, contactX);
      this.scene.tweens.add({
        targets:  attacker,
        x:        contactX,
        duration: approachMs,
        ease:     'Linear',
        onComplete: () => {
          // ── Perform action ───────────────────────────────────────────────
          this.setPhase('perform_action');
          attacker.playAnim(move.animFolder, true);

          // Determine when the hit frame fires
          const animKey  = `${attacker.actorId}_${move.animFolder}`;
          const animData = this.scene.anims.get(animKey);
          const hitMs    = animData
            ? (1000 / (animData.frameRate || 12)) * (move.hitFrameIndex + 1)
            : 200;

          this.scene.time.delayedCall(hitMs, () => {
            // ── Apply hit ───────────────────────────────────────────────
            this.setPhase('apply_hit');
            if (move.power > 0) {
              const dmg = this.calcDamage(attacker, move);
              defender.hp = Math.max(0, defender.hp - dmg);
              this.callbacks.onDamageDealt(
                action.role === 'player' ? 'enemy' : 'player',
                dmg,
                defender.x,
                defender.y - 40,
              );
              defender.flashDamage();
            }

            // ── Target reaction ─────────────────────────────────────────
            this.setPhase('target_reaction');
            if (move.targetReaction === 'hurt') {
              defender.playAnim('hurt', true);
              this.scene.time.delayedCall(350, () => defender.playAnim('idle'));
            }

            // ── Return to anchor ────────────────────────────────────────
            this.scene.time.delayedCall(500, () => {
              if (move.returnToAnchor) {
                this.setPhase('return_to_anchor');
                // Face away from opponent to run back
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

    } else {
      // 'stay' — guard / buff / etc.
      this.setPhase('perform_action');
      attacker.playAnim(move.animFolder, true);
      this.scene.time.delayedCall(700, () => {
        attacker.playAnim('idle');
        this.busy = false;
        this.afterAction();
      });
    }
  }

  private afterAction(): void {
    // Check for battle end
    if (this.enemy.hp <= 0) {
      this.setPhase('victory');
      this.callbacks.onBattleEnd('player');
      return;
    }
    if (this.player.hp <= 0) {
      this.setPhase('defeat');
      this.callbacks.onBattleEnd('enemy');
      return;
    }

    if (this.actionQueue.length > 0) {
      // Enemy action still pending — brief pause then execute it
      this.scene.time.delayedCall(400, () => {
        this.setPhase('action_queue');
        this.executeNextAction();
      });
    } else {
      // Both actions done — end turn
      this.setPhase('turn_end');
      this.scene.time.delayedCall(600, () => this.openCommandMenu());
    }
  }

  private travelMs(fromX: number, toX: number): number {
    return Math.max(150, (Math.abs(toX - fromX) / APPROACH_SPEED) * 1000);
  }

  private calcDamage(attacker: ClassicActor, move: { power: number }): number {
    const atkStat = attacker.minariData.stats.power;
    const roll    = 0.85 + Math.random() * 0.15;
    return Math.round((move.power * (atkStat / 60)) * roll);
  }
}
