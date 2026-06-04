export type HitboxShape = 'rect' | 'circle';
export type ProjectileType = 'linear' | 'arc' | 'homing';
export type MoveCategory = 'melee' | 'projectile' | 'buff' | 'debuff' | 'summon';

export interface Hitbox {
  shape: HitboxShape;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface CoreAttackHit {
  damage: number;
  hitbox: Hitbox;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  knockbackX: number;
  knockbackY: number;
}

export interface CoreAttackConfig {
  id: string;
  name: string;
  animKey: string;
  comboHits: CoreAttackHit[];
  comboWindow: number;
  cooldown: number;
}

export interface MoveData {
  id: string;
  name: string;
  description: string;
  category: MoveCategory;
  auraCost: number;
  damage: number;
  hitbox: Hitbox;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  cooldown: number;
  projectileSpeed?: number;
  projectileType?: ProjectileType;
  buffDuration?: number;
  range: 'close' | 'mid' | 'far' | 'self';
  colorTint: number;
}

export interface FormData {
  id: string;
  name: string;
  displayText: string;
  duration: number;
  auraPerSecond: number;
  damageMult: number;
  defenseMult: number;
  speedMult: number;
  glowColor: number;
  activationCondition: 'soulbond' | 'hp' | 'always';
  activationThreshold: number;
}

export interface UltimateData {
  id: string;
  name: string;
  displayText: string;
  damage: number;
  range: number;
  soulbondCost: number;
  pauseDuration: number;
}

export type BattleEventType =
  | 'hit'
  | 'block'
  | 'dodge'
  | 'ability_start'
  | 'ability_end'
  | 'ultimate'
  | 'victory'
  | 'defeat';

export interface BattleEvent {
  type: BattleEventType;
  sourceId: string;
  targetId?: string;
  value?: number;
  timestamp: number;
}
