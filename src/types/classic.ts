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
  damageType: string;
  returnToAnchor: boolean;
  auraCost?: number;
}

export interface PendingAction {
  role: ClassicActorRole;
  moveId: string;
}

export interface EngineCallbacks {
  onPhaseChange: (phase: ClassicBattlePhase) => void;
  onShowCommandMenu: () => void;
  onHideCommandMenu: () => void;
  onDamageDealt: (
    target: ClassicActorRole,
    amount: number,
    worldX: number,
    worldY: number,
  ) => void;
  onBattleEnd: (winner: ClassicActorRole) => void;
}
