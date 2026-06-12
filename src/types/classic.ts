export type ClassicBattlePhase =
  | 'battle_intro'
  | 'idle'
  | 'player_command'
  | 'action_queue'
  | 'approach_target'
  | 'perform_action'
  | 'apply_hit'
  | 'target_reaction'
  | 'return_to_anchor'
  | 'turn_end'
  | 'victory'
  | 'defeat';

export type ClassicActorRole = 'player' | 'enemy';

export interface ClassicMoveConfig {
  id: string;
  displayName: string;
  /** Animation folder key: 'attack', 'guard', 'actions/flame_paw_barrage', etc. */
  animFolder: string;
  approachAnim: string;   // 'run' | 'idle'
  returnAnim: string;     // 'run' | 'idle'
  targetReaction: string; // 'hurt' | 'none'
  movementType: 'dash_to_target' | 'stay';
  /** 0-based frame index in the attack animation that triggers damage. */
  hitFrameIndex: number;
  power: number;
  /** Element / damage flavour used for type-advantage lookup. */
  damageType: string;
  /** 'physical' uses attack vs defense; 'special' uses specialAttack vs specialDefense. */
  category: 'physical' | 'special' | 'status';
  /** Hit accuracy 0–100. Moves with accuracy < 100 can miss. Defaults to 100. */
  accuracy?: number;
  /** Whether this move can roll a critical hit. */
  canCrit: boolean;
  /** Turn priority; higher acts first. Guard default +4, normal moves default 0. */
  priority?: number;
  returnToAnchor: boolean;
  auraCost?: number;
  /** Flat Aura restored to user when the move is used (guard/stance moves). */
  auraGain?: number;
  /** Soul Sync delta applied to the target on hit (negative = sync damage). Status moves. */
  syncDamage?: number;
  /**
   * If true, the actor stays in this animation through the opponent's entire
   * turn, only returning to idle after all queued actions are resolved.
   * Used for Guard and future defensive stances.
   */
  holdsStance?: boolean;
  /** Short flavour description shown in menus. */
  description?: string;
}

export interface PendingAction {
  role: ClassicActorRole;
  moveId: string;
}

/** Extra metadata about a single hit, provided alongside onDamageDealt. */
export interface CombatHitMeta {
  isCrit:        boolean;
  typeModifier:  number;
  typeAdvantage: boolean;
  typeResisted:  boolean;
}

export interface EngineCallbacks {
  onPhaseChange: (phase: ClassicBattlePhase) => void;
  onShowCommandMenu: () => void;
  onHideCommandMenu: () => void;
  onDamageDealt: (
    target:  ClassicActorRole,
    amount:  number,
    blocked: boolean,
    worldX:  number,
    worldY:  number,
  ) => void;
  onBattleEnd: (winner: ClassicActorRole) => void;
  /** Called when a move is announced (before its animation plays). */
  onMoveAnnounce?: (attackerRole: ClassicActorRole, moveId: string, moveName: string) => void;
  /** Called when a move misses its accuracy roll. */
  onMoveMiss?: (attackerRole: ClassicActorRole, moveName: string) => void;
  /** Optional: return the attacker's current Soul Sync tier for damage modifiers. */
  getSyncTier?: (attackerRole: ClassicActorRole) => string;
  /** Optional: called immediately after onDamageDealt with hit metadata. */
  onHitMeta?:  (target: ClassicActorRole, meta: CombatHitMeta) => void;
  /** Optional: called when a sync-damage status move connects. */
  onSyncDamage?: (target: ClassicActorRole, delta: number) => void;
  /** Optional: called when a guard/stance move is blocked because it was used last turn. */
  onGuardBlocked?: (role: ClassicActorRole) => void;
}
