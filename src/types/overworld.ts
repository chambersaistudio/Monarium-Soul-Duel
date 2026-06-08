// Normalized (0-1) rect — multiply by viewport width/height to get pixels.
export interface NormRect {
  x: number; y: number; w: number; h: number;
}

export interface MapSpawn {
  /** Normalized X (0-1 of viewport width). */
  x: number;
  /** Normalized Y (0-1 of viewport height). Anchored to player feet. */
  y: number;
}

export interface MapExit {
  id:          string;
  rect:        NormRect;
  targetMap:   string;
  targetSpawn: string;
}

export interface NpcDef {
  id:            string;
  displayName:   string;
  x:             number;  // normalized
  y:             number;  // normalized
  /** Normalized radius (fraction of min(w,h)). */
  interactRadius: number;
  color:         number;
  /** If set, interacting starts a ClassicSoulDuel vs this challenger id. */
  challengerId?: string;
  /** Lines shown when player interacts (non-battle). */
  dialog?:       string[];
  /** Unique role — used to skip Renzo's dialog after starter chosen, etc. */
  role?:         'professor' | 'rival' | 'starter_pedestal_1' | 'starter_pedestal_2' | 'starter_pedestal_3';
}

export interface EncounterOrb {
  id:       string;
  x:        number;  // normalized
  y:        number;  // normalized
  minariId: string;
  color:    number;
  bondable: boolean;
}

export interface MapDef {
  id:             string;
  displayName:    string;
  bgKey:          string;
  bgPath:         string;
  spawns:         Record<string, MapSpawn>;
  defaultSpawn:   string;
  /** Normalized AABB rects that block the player. */
  collisionRects: NormRect[];
  exits:          MapExit[];
  npcs:           NpcDef[];
  encounterOrbs:  EncounterOrb[];
}

export interface ClassicBattleContext {
  returnMap:     string;
  returnSpawn:   string;
  playerMinariId: string;
  enemyMinariId:  string;
  bondable:      boolean;
  battleType:    'rival' | 'wild';
}
