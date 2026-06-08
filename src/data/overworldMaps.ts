import type { MapDef } from '../types/overworld';

/**
 * All coordinates are NORMALIZED (0-1 fraction of the current viewport).
 * Multiply by this.scale.width / this.scale.height in-scene to get pixels.
 *
 * Collision rects use (x, y) as top-left corner.
 * Exit rects use (x, y) as top-left corner.
 * Spawn points use (x, y) as the player's FEET position.
 *
 * TODO: Once the maps render, tune the collision rects to match buildings /
 * terrain in the background images. These are reasonable first-pass guesses.
 */

// ── Shared border walls (keeps player on screen) ────────────────────────────
const BORDER_T = { x: 0,    y: 0,    w: 1,    h: 0.02 };
const BORDER_B = { x: 0,    y: 0.98, w: 1,    h: 0.02 };
const BORDER_L = { x: 0,    y: 0,    w: 0.02, h: 1    };
const BORDER_R = { x: 0.98, y: 0,    w: 0.02, h: 1    };
const ALL_BORDERS = [BORDER_T, BORDER_B, BORDER_L, BORDER_R];

// ── Map definitions ──────────────────────────────────────────────────────────

export const OVERWORLD_MAPS: Record<string, MapDef> = {

  // ── Starter Village ────────────────────────────────────────────────────────
  starter_village: {
    id:          'starter_village',
    displayName: 'Starter Village',
    bgKey:       'ow_bg_starter_village',
    bgPath:      'assets/backgrounds/overworld/starter_village.png',
    spawns: {
      default:           { x: 0.50, y: 0.58 },
      from_forest:       { x: 0.50, y: 0.12 },
      from_training:     { x: 0.10, y: 0.52 },
      from_cave:         { x: 0.90, y: 0.52 },
      from_beach:        { x: 0.50, y: 0.88 },
      from_lab:          { x: 0.50, y: 0.52 },
    },
    defaultSpawn: 'default',
    collisionRects: [
      ...ALL_BORDERS,
      // Lab building (roughly center-north of the village)
      { x: 0.38, y: 0.22, w: 0.24, h: 0.14 },
      // Left cluster buildings
      { x: 0.08, y: 0.22, w: 0.18, h: 0.16 },
      // Right cluster buildings
      { x: 0.74, y: 0.22, w: 0.18, h: 0.16 },
      // Bottom-left fencing / water
      { x: 0.06, y: 0.68, w: 0.18, h: 0.18 },
      // Bottom-right fencing / water
      { x: 0.76, y: 0.68, w: 0.18, h: 0.18 },
    ],
    exits: [
      { id: 'to_forest',   rect: { x: 0.40, y: 0.00, w: 0.20, h: 0.03 }, targetMap: 'forest_route',    targetSpawn: 'from_village' },
      { id: 'to_training', rect: { x: 0.00, y: 0.40, w: 0.03, h: 0.20 }, targetMap: 'training_field',  targetSpawn: 'from_village' },
      { id: 'to_cave',     rect: { x: 0.97, y: 0.40, w: 0.03, h: 0.20 }, targetMap: 'crystal_cave',    targetSpawn: 'from_village' },
      { id: 'to_beach',    rect: { x: 0.40, y: 0.97, w: 0.20, h: 0.03 }, targetMap: 'coastal_beach',   targetSpawn: 'from_village' },
    ],
    npcs: [
      {
        id:            'lab_door',
        displayName:   'Bond Lab',
        x:             0.50,
        y:             0.37,
        interactRadius: 0.06,
        color:          0x88aaff,
        role:           'professor',
        dialog:         ['The Bond Lab door is open. Step inside.'],
      },
    ],
    encounterOrbs: [],
  },

  // ── Bond Lab Interior ───────────────────────────────────────────────────────
  bond_lab_interior: {
    id:          'bond_lab_interior',
    displayName: 'Bond Lab',
    bgKey:       'ow_bg_bond_lab_interior',
    bgPath:      'assets/backgrounds/overworld/bond_lab_interior.png',
    spawns: {
      default:     { x: 0.50, y: 0.80 },
      from_exit:   { x: 0.50, y: 0.80 },
    },
    defaultSpawn: 'default',
    collisionRects: [
      ...ALL_BORDERS,
      // Counter / lab bench along the top
      { x: 0.05, y: 0.10, w: 0.90, h: 0.08 },
      // Left wall alcove
      { x: 0.02, y: 0.18, w: 0.10, h: 0.50 },
      // Right wall alcove
      { x: 0.88, y: 0.18, w: 0.10, h: 0.50 },
    ],
    exits: [
      { id: 'to_village', rect: { x: 0.38, y: 0.88, w: 0.24, h: 0.10 }, targetMap: 'starter_village', targetSpawn: 'from_lab' },
    ],
    npcs: [
      {
        id:            'professor',
        displayName:   'Professor',
        x:             0.50,
        y:             0.25,
        interactRadius: 0.08,
        color:          0xffdd88,
        role:           'professor',
        dialog:         [
          'Professor: Welcome to the Bond Lab! Three Minari await a partner.',
          'Professor: Approach a pedestal to choose your first Soulbond companion.',
        ],
      },
      {
        id:            'pedestal_flarepaw',
        displayName:   'Flarepaw',
        x:             0.25,
        y:             0.48,
        interactRadius: 0.07,
        color:          0xff5500,
        role:           'starter_pedestal_1',
        dialog:         ['Flarepaw — Fire type. Fierce and loyal.'],
      },
      {
        id:            'pedestal_droplet',
        displayName:   'Droplet',
        x:             0.50,
        y:             0.45,
        interactRadius: 0.07,
        color:          0x0088dd,
        role:           'starter_pedestal_2',
        dialog:         ['Droplet — Water type. Swift and adaptable.'],
      },
      {
        id:            'pedestal_umbravine',
        displayName:   'Umbravine',
        x:             0.75,
        y:             0.48,
        interactRadius: 0.07,
        color:          0x5533aa,
        role:           'starter_pedestal_3',
        dialog:         ['Umbravine — Shadow type. Mysterious and resilient.'],
      },
    ],
    encounterOrbs: [],
  },

  // ── Training Field ──────────────────────────────────────────────────────────
  training_field: {
    id:          'training_field',
    displayName: 'Training Field',
    bgKey:       'ow_bg_training_field',
    bgPath:      'assets/backgrounds/overworld/training_field.png',
    spawns: {
      default:      { x: 0.30, y: 0.60 },
      from_village: { x: 0.90, y: 0.55 },
      from_battle:  { x: 0.30, y: 0.60 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [
      ...ALL_BORDERS,
      // Rocky ledge left side
      { x: 0.02, y: 0.25, w: 0.14, h: 0.30 },
      // Rocky ledge right side
      { x: 0.84, y: 0.25, w: 0.14, h: 0.30 },
      // Training dummies / obstacle row center-top
      { x: 0.30, y: 0.18, w: 0.40, h: 0.08 },
    ],
    exits: [
      { id: 'to_village', rect: { x: 0.97, y: 0.35, w: 0.03, h: 0.30 }, targetMap: 'starter_village', targetSpawn: 'from_training' },
    ],
    npcs: [
      {
        id:            'renzo',
        displayName:   'Renzo',
        x:             0.55,
        y:             0.55,
        interactRadius: 0.09,
        color:          0x4488ff,
        role:           'rival',
        challengerId:   'renzo',
        dialog:         ['Renzo: I\'m always ready for a spar!'],
      },
    ],
    encounterOrbs: [],
  },

  // ── Forest Route ────────────────────────────────────────────────────────────
  forest_route: {
    id:          'forest_route',
    displayName: 'Forest Route',
    bgKey:       'ow_bg_forest_route',
    bgPath:      'assets/backgrounds/overworld/forest_route.png',
    spawns: {
      default:      { x: 0.50, y: 0.80 },
      from_village: { x: 0.50, y: 0.88 },
      from_battle:  { x: 0.50, y: 0.50 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [
      ...ALL_BORDERS,
      // Dense trees left wall
      { x: 0.02, y: 0.05, w: 0.14, h: 0.88 },
      // Dense trees right wall
      { x: 0.84, y: 0.05, w: 0.14, h: 0.88 },
      // Fallen log / obstacle mid-route
      { x: 0.25, y: 0.48, w: 0.20, h: 0.06 },
      { x: 0.55, y: 0.32, w: 0.20, h: 0.06 },
    ],
    exits: [
      { id: 'to_village', rect: { x: 0.30, y: 0.96, w: 0.40, h: 0.04 }, targetMap: 'starter_village', targetSpawn: 'from_forest' },
    ],
    npcs: [],
    encounterOrbs: [
      { id: 'orb_forest_1', x: 0.30, y: 0.30, minariId: 'droplet',   color: 0x00ccff, bondable: true },
      { id: 'orb_forest_2', x: 0.65, y: 0.22, minariId: 'droplet',   color: 0x00ccff, bondable: true },
      { id: 'orb_forest_3', x: 0.42, y: 0.58, minariId: 'umbravine', color: 0x8833ff, bondable: true },
      { id: 'orb_forest_4', x: 0.72, y: 0.65, minariId: 'umbravine', color: 0x8833ff, bondable: true },
    ],
  },

  // ── Crystal Cave ────────────────────────────────────────────────────────────
  crystal_cave: {
    id:          'crystal_cave',
    displayName: 'Crystal Cave',
    bgKey:       'ow_bg_crystal_cave',
    bgPath:      'assets/backgrounds/overworld/crystal_cave.png',
    spawns: {
      default:      { x: 0.15, y: 0.55 },
      from_village: { x: 0.08, y: 0.55 },
      from_battle:  { x: 0.50, y: 0.50 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [
      ...ALL_BORDERS,
      // Crystal formation top-center
      { x: 0.32, y: 0.08, w: 0.36, h: 0.14 },
      // Cave walls narrowing
      { x: 0.02, y: 0.05, w: 0.06, h: 0.38 },
      { x: 0.02, y: 0.62, w: 0.06, h: 0.35 },
      { x: 0.92, y: 0.08, w: 0.06, h: 0.84 },
      // Large crystal cluster center
      { x: 0.42, y: 0.40, w: 0.18, h: 0.22 },
    ],
    exits: [
      { id: 'to_village', rect: { x: 0.00, y: 0.40, w: 0.03, h: 0.20 }, targetMap: 'starter_village', targetSpawn: 'from_cave' },
    ],
    npcs: [],
    encounterOrbs: [
      { id: 'orb_cave_1', x: 0.28, y: 0.28, minariId: 'umbravine', color: 0x8833ff, bondable: true },
      { id: 'orb_cave_2', x: 0.70, y: 0.24, minariId: 'umbravine', color: 0x8833ff, bondable: true },
      { id: 'orb_cave_3', x: 0.25, y: 0.68, minariId: 'flarepaw',  color: 0xff4400, bondable: true },
      { id: 'orb_cave_4', x: 0.68, y: 0.72, minariId: 'flarepaw',  color: 0xff4400, bondable: true },
    ],
  },

  // ── Coastal Beach ────────────────────────────────────────────────────────────
  coastal_beach: {
    id:          'coastal_beach',
    displayName: 'Coastal Beach',
    bgKey:       'ow_bg_coastal_beach',
    bgPath:      'assets/backgrounds/overworld/coastal_beach.png',
    spawns: {
      default:      { x: 0.50, y: 0.20 },
      from_village: { x: 0.50, y: 0.12 },
      from_battle:  { x: 0.50, y: 0.40 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [
      ...ALL_BORDERS,
      // Ocean water (lower half is impassable)
      { x: 0.02, y: 0.65, w: 0.96, h: 0.32 },
      // Rock formations left
      { x: 0.04, y: 0.10, w: 0.10, h: 0.40 },
      // Rock formations right
      { x: 0.86, y: 0.10, w: 0.10, h: 0.40 },
    ],
    exits: [
      { id: 'to_village', rect: { x: 0.30, y: 0.00, w: 0.40, h: 0.03 }, targetMap: 'starter_village', targetSpawn: 'from_beach' },
    ],
    npcs: [],
    encounterOrbs: [
      { id: 'orb_beach_1', x: 0.28, y: 0.35, minariId: 'droplet', color: 0x00ccff, bondable: true },
      { id: 'orb_beach_2', x: 0.58, y: 0.28, minariId: 'droplet', color: 0x00ccff, bondable: true },
      { id: 'orb_beach_3', x: 0.40, y: 0.55, minariId: 'droplet', color: 0x00ccff, bondable: true },
      { id: 'orb_beach_4', x: 0.72, y: 0.45, minariId: 'droplet', color: 0x00ccff, bondable: true },
    ],
  },
};
