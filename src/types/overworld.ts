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
  id:               string;
  rect:             NormRect;
  targetMap:        string;
  targetSpawn:      string;
  /** If true, player must press ENTER/E while in the zone instead of auto-travel. */
  requiresInteract?: boolean;
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
  id:               string;
  displayName:      string;
  bgKey:            string;
  bgPath:           string;
  /** Optional logic-mask PNG key (loaded by PreloadScene). Omit if no mask exists yet. */
  maskKey?:         string;
  spawns:           Record<string, MapSpawn>;
  defaultSpawn:     string;
  /** Fallback AABB rects used only when no mask is loaded. */
  collisionRects:   NormRect[];
  exits:            MapExit[];
  npcs:             NpcDef[];
  encounterOrbs:    EncounterOrb[];
  /** Weighted encounter table — minariId → weight. Used by wild-encounter logic. */
  encounterTable?:  Record<string, number>;
}

export interface BattleStatOverrides {
  attack?: number;
  specialAttack?: number;
  defense?: number;
  specialDefense?: number;
  speed?: number;
}

export interface ClassicBattleContext {
  returnMap:      string;
  returnSpawn:    string;
  playerMinariId: string;
  enemyMinariId:  string;
  bondable:       boolean;
  battleType:     'rival' | 'wild' | 'lab';
  playerLevel?:   number;
  enemyLevel?:    number;
  labMode?:       boolean;
  labDebug?:      boolean;
  playerStatOverrides?: BattleStatOverrides;
  enemyStatOverrides?:  BattleStatOverrides;
}
