import type { MapDef } from '../types/overworld';

/**
 * All coordinates are NORMALIZED (0-1 fraction of the current viewport).
 * Multiply by this.scale.width / this.scale.height in-scene to get pixels.
 *
 * Exit zones are generous strips near map borders so they're reachable.
 * Player feet (playerY) can reach as low as playerH/2 ≈ 22 px, so north
 * exits start at y=0 with h=0.10 (60 px at 600 h) — plenty of overlap.
 *
 * collisionRects is intentionally empty: the OverworldMaskSystem handles
 * collision when a mask PNG is present.  These rects are only used as a
 * fallback when the mask hasn't been painted yet.
 */

export const OVERWORLD_MAPS: Record<string, MapDef> = {

  // ── Starter Village ──────────────────────────────────────────────────────────
  starter_village: {
    id:          'starter_village',
    displayName: 'Starter Village',
    bgKey:       'ow_bg_starter_village',
    bgPath:      'assets/backgrounds/overworld/starter_village.png',
    maskKey:     'ow_mask_starter_village',
    spawns: {
      default:       { x: 0.50, y: 0.60 },
      from_forest:   { x: 0.50, y: 0.14 },
      from_training: { x: 0.14, y: 0.50 },
      from_cave:     { x: 0.86, y: 0.50 },
      from_beach:    { x: 0.50, y: 0.86 },
      from_lab:      { x: 0.50, y: 0.55 },
    },
    defaultSpawn: 'default',
    collisionRects: [],   // mask handles collision
    exits: [
      { id: 'to_forest',   rect: { x: 0.32, y: 0.00, w: 0.36, h: 0.10 }, targetMap: 'forest_route',      targetSpawn: 'from_village' },
      { id: 'to_training', rect: { x: 0.00, y: 0.32, w: 0.10, h: 0.36 }, targetMap: 'training_field',    targetSpawn: 'from_village' },
      { id: 'to_cave',     rect: { x: 0.90, y: 0.32, w: 0.10, h: 0.36 }, targetMap: 'crystal_cave',      targetSpawn: 'from_village' },
      { id: 'to_beach',    rect: { x: 0.32, y: 0.90, w: 0.36, h: 0.10 }, targetMap: 'coastal_beach',     targetSpawn: 'from_village' },
    ],
    npcs: [
      {
        id:             'lab_door',
        displayName:    'Bond Lab',
        x:              0.50,
        y:              0.40,
        interactRadius: 0.08,
        color:          0x88aaff,
        role:           'professor',
        dialog:         ['Bond Lab entrance. Step inside.'],
      },
    ],
    encounterOrbs:  [],
    encounterTable: {},
  },

  // ── Bond Lab Interior ────────────────────────────────────────────────────────
  bond_lab_interior: {
    id:          'bond_lab_interior',
    displayName: 'Bond Lab',
    bgKey:       'ow_bg_bond_lab_interior',
    bgPath:      'assets/backgrounds/overworld/bond_lab_interior.png',
    maskKey:     'ow_mask_bond_lab_interior',
    spawns: {
      default:   { x: 0.50, y: 0.82 },
      from_exit: { x: 0.50, y: 0.82 },
    },
    defaultSpawn: 'default',
    collisionRects: [],
    exits: [
      { id: 'to_village', rect: { x: 0.32, y: 0.90, w: 0.36, h: 0.10 }, targetMap: 'starter_village', targetSpawn: 'from_lab' },
    ],
    npcs: [
      {
        id:             'professor',
        displayName:    'Professor',
        x:              0.50,
        y:              0.25,
        interactRadius: 0.09,
        color:          0xffdd88,
        role:           'professor',
        dialog:         [
          'Professor: Welcome to the Bond Lab! Three Minari await a partner.',
          'Professor: Approach a pedestal to choose your first Soulbond companion.',
        ],
      },
      {
        id:             'pedestal_flarepaw',
        displayName:    'Flarepaw',
        x:              0.25,
        y:              0.50,
        interactRadius: 0.08,
        color:          0xff5500,
        role:           'starter_pedestal_1',
        dialog:         ['Flarepaw — Fire type. Fierce and loyal.'],
      },
      {
        id:             'pedestal_droplet',
        displayName:    'Droplet',
        x:              0.50,
        y:              0.48,
        interactRadius: 0.08,
        color:          0x0088dd,
        role:           'starter_pedestal_2',
        dialog:         ['Droplet — Water type. Swift and adaptable.'],
      },
      {
        id:             'pedestal_umbravine',
        displayName:    'Umbravine',
        x:              0.75,
        y:              0.50,
        interactRadius: 0.08,
        color:          0x5533aa,
        role:           'starter_pedestal_3',
        dialog:         ['Umbravine — Shadow type. Mysterious and resilient.'],
      },
    ],
    encounterOrbs:  [],
    encounterTable: {},
  },

  // ── Training Field ───────────────────────────────────────────────────────────
  training_field: {
    id:          'training_field',
    displayName: 'Training Field',
    bgKey:       'ow_bg_training_field',
    bgPath:      'assets/backgrounds/overworld/training_field.png',
    maskKey:     'ow_mask_training_field',
    spawns: {
      default:      { x: 0.30, y: 0.60 },
      from_village: { x: 0.86, y: 0.50 },
      from_battle:  { x: 0.30, y: 0.60 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [],
    exits: [
      { id: 'to_village', rect: { x: 0.90, y: 0.32, w: 0.10, h: 0.36 }, targetMap: 'starter_village', targetSpawn: 'from_training' },
    ],
    npcs: [
      {
        id:             'renzo',
        displayName:    'Renzo',
        x:              0.50,
        y:              0.52,
        interactRadius: 0.09,
        color:          0x4488ff,
        role:           'rival',
        challengerId:   'renzo',
        dialog:         ["Renzo: I'm always ready for a spar!"],
      },
    ],
    encounterOrbs:  [],
    encounterTable: {},
  },

  // ── Forest Route ─────────────────────────────────────────────────────────────
  forest_route: {
    id:          'forest_route',
    displayName: 'Forest Route',
    bgKey:       'ow_bg_forest_route',
    bgPath:      'assets/backgrounds/overworld/forest_route.png',
    maskKey:     'ow_mask_forest_route',
    spawns: {
      default:      { x: 0.50, y: 0.82 },
      from_village: { x: 0.50, y: 0.86 },
      from_battle:  { x: 0.50, y: 0.50 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [],
    exits: [
      { id: 'to_village', rect: { x: 0.32, y: 0.90, w: 0.36, h: 0.10 }, targetMap: 'starter_village', targetSpawn: 'from_forest' },
    ],
    npcs: [],
    encounterOrbs: [
      { id: 'orb_forest_1', x: 0.28, y: 0.32, minariId: 'droplet',   color: 0x00ccff, bondable: true },
      { id: 'orb_forest_2', x: 0.65, y: 0.22, minariId: 'flarepaw',  color: 0xff4400, bondable: true },
      { id: 'orb_forest_3', x: 0.40, y: 0.55, minariId: 'umbravine', color: 0x8833ff, bondable: true },
      { id: 'orb_forest_4', x: 0.72, y: 0.65, minariId: 'droplet',   color: 0x00ccff, bondable: true },
    ],
    encounterTable: { droplet: 50, umbravine: 30, flarepaw: 20 },
  },

  // ── Crystal Cave ─────────────────────────────────────────────────────────────
  crystal_cave: {
    id:          'crystal_cave',
    displayName: 'Crystal Cave',
    bgKey:       'ow_bg_crystal_cave',
    bgPath:      'assets/backgrounds/overworld/crystal_cave.png',
    maskKey:     'ow_mask_crystal_cave',
    spawns: {
      default:      { x: 0.14, y: 0.50 },
      from_village: { x: 0.14, y: 0.50 },
      from_battle:  { x: 0.50, y: 0.50 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [],
    exits: [
      { id: 'to_village', rect: { x: 0.00, y: 0.32, w: 0.10, h: 0.36 }, targetMap: 'starter_village', targetSpawn: 'from_cave' },
    ],
    npcs: [],
    encounterOrbs: [
      { id: 'orb_cave_1', x: 0.35, y: 0.30, minariId: 'umbravine', color: 0x8833ff, bondable: true },
      { id: 'orb_cave_2', x: 0.70, y: 0.24, minariId: 'umbravine', color: 0x8833ff, bondable: true },
      { id: 'orb_cave_3', x: 0.28, y: 0.68, minariId: 'flarepaw',  color: 0xff4400, bondable: true },
      { id: 'orb_cave_4', x: 0.68, y: 0.72, minariId: 'flarepaw',  color: 0xff4400, bondable: true },
    ],
    encounterTable: { umbravine: 60, flarepaw: 40 },
  },

  // ── Coastal Beach ─────────────────────────────────────────────────────────────
  coastal_beach: {
    id:          'coastal_beach',
    displayName: 'Coastal Beach',
    bgKey:       'ow_bg_coastal_beach',
    bgPath:      'assets/backgrounds/overworld/coastal_beach.png',
    maskKey:     'ow_mask_coastal_beach',
    spawns: {
      default:      { x: 0.50, y: 0.22 },
      from_village: { x: 0.50, y: 0.14 },
      from_battle:  { x: 0.50, y: 0.40 },
    },
    defaultSpawn: 'from_village',
    collisionRects: [],
    exits: [
      { id: 'to_village', rect: { x: 0.32, y: 0.00, w: 0.36, h: 0.10 }, targetMap: 'starter_village', targetSpawn: 'from_beach' },
    ],
    npcs: [],
    encounterOrbs: [
      { id: 'orb_beach_1', x: 0.28, y: 0.38, minariId: 'droplet', color: 0x00ccff, bondable: true },
      { id: 'orb_beach_2', x: 0.58, y: 0.30, minariId: 'droplet', color: 0x00ccff, bondable: true },
      { id: 'orb_beach_3', x: 0.40, y: 0.55, minariId: 'droplet', color: 0x00ccff, bondable: true },
      { id: 'orb_beach_4', x: 0.72, y: 0.48, minariId: 'flarepaw', color: 0xff4400, bondable: true },
    ],
    encounterTable: { droplet: 80, flarepaw: 20 },
  },
};
