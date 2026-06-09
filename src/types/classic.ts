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
  /** Whether this move can roll a critical hit. */
  canCrit: boolean;
  returnToAnchor: boolean;
  auraCost?: number;
  /**
   * If true, the actor stays in this animation through the opponent's entire
   * turn, only returning to idle after all queued actions are resolved.
   * Used for Guard and future defensive stances.
   */
  holdsStance?: boolean;
}

export interface PendingAction {
  role: ClassicActorRole;
  moveId: string;
}

/** Extra metadata about a single hit, provided alongside onDamageDealt. */
export interface CombatHitMeta {
  isCrit:        boolean;
  typeAdvantage: boolean;  // attacker hit into a weakness (type multiplier > 1.0)
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
  /** Optional: return the attacker's current Soul Sync tier for damage modifiers. */
  getSyncTier?: (attackerRole: ClassicActorRole) => string;
  /** Optional: called immediately after onDamageDealt with hit metadata. */
  onHitMeta?:  (target: ClassicActorRole, meta: CombatHitMeta) => void;
}
