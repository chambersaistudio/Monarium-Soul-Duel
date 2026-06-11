export type StoryMapId = 'starter_village' | 'bond_lab_interior' | 'training_field' | 'coastal_beach' | 'crystal_cave' | 'forest_route';

export interface StorySpawn { x: number; y: number }
export interface StoryExit { edge?: 'north' | 'south' | 'west' | 'east'; markerId?: string; to: StoryMapId; spawn: string; label?: string }
export interface StoryInteraction { id: string; label: string; x: number; y: number; radius: number; kind: 'lab' | 'exit' | 'professor' | 'starter' | 'renzo' | 'orb'; targetId?: string }
export interface StoryMapDef {
  id: StoryMapId;
  displayName: string;
  background: string;
  spawns: Record<string, StorySpawn>;
  exits: StoryExit[];
  interactions: StoryInteraction[];
  encounters?: boolean;
}

export const STORY_MAPS: Record<StoryMapId, StoryMapDef> = {
  starter_village: {
    id: 'starter_village',
    displayName: 'Starter Village',
    background: 'assets/backgrounds/overworld/starter_village.png',
    spawns: {
      default: { x: 0.52, y: 0.68 },
      from_lab: { x: 0.31, y: 0.47 },
      north: { x: 0.5, y: 0.10 }, south: { x: 0.5, y: 0.90 }, west: { x: 0.10, y: 0.58 }, east: { x: 0.90, y: 0.58 },
    },
    exits: [
      { edge: 'north', to: 'training_field', spawn: 'south' },
      { edge: 'south', to: 'coastal_beach', spawn: 'north' },
      { edge: 'west', to: 'crystal_cave', spawn: 'east' },
      { edge: 'east', to: 'forest_route', spawn: 'west' },
    ],
    interactions: [{ id: 'bond_lab', label: 'Bond Lab', x: 0.30, y: 0.36, radius: 0.085, kind: 'lab' }],
  },
  bond_lab_interior: {
    id: 'bond_lab_interior',
    displayName: 'Bond Lab',
    background: 'assets/backgrounds/overworld/bond_lab_interior.png',
    spawns: { default: { x: 0.50, y: 0.74 }, exit: { x: 0.50, y: 0.78 } },
    exits: [{ edge: 'south', to: 'starter_village', spawn: 'from_lab' }],
    interactions: [
      { id: 'professor', label: 'Dr. Warren Ellis', x: 0.50, y: 0.33, radius: 0.08, kind: 'professor' },
      { id: 'starter_flarepaw', label: 'Flarepaw', x: 0.32, y: 0.55, radius: 0.075, kind: 'starter', targetId: 'flarepaw' },
      { id: 'starter_droplet', label: 'Droplet', x: 0.50, y: 0.57, radius: 0.075, kind: 'starter', targetId: 'droplet' },
      { id: 'starter_sproutodon', label: 'Sproutodon', x: 0.68, y: 0.55, radius: 0.075, kind: 'starter', targetId: 'sproutodon' },
    ],
  },
  training_field: {
    id: 'training_field', displayName: 'Training Field', background: 'assets/backgrounds/overworld/training_field.png',
    spawns: { south: { x: 0.5, y: 0.86 }, north: { x: 0.5, y: 0.16 }, default: { x: 0.5, y: 0.78 } },
    exits: [{ edge: 'south', to: 'starter_village', spawn: 'north' }],
    interactions: [],
  },
  coastal_beach: {
    id: 'coastal_beach', displayName: 'Coastal Beach', background: 'assets/backgrounds/overworld/coastal_beach.png',
    spawns: { north: { x: 0.5, y: 0.15 }, default: { x: 0.5, y: 0.30 } }, exits: [{ edge: 'north', to: 'starter_village', spawn: 'south' }], interactions: [], encounters: true,
  },
  crystal_cave: {
    id: 'crystal_cave', displayName: 'Crystal Cave', background: 'assets/backgrounds/overworld/crystal_cave.png',
    spawns: { east: { x: 0.86, y: 0.58 }, default: { x: 0.70, y: 0.58 } }, exits: [{ edge: 'east', to: 'starter_village', spawn: 'west' }], interactions: [], encounters: true,
  },
  forest_route: {
    id: 'forest_route', displayName: 'Forest Route', background: 'assets/backgrounds/overworld/forest_route.png',
    spawns: { west: { x: 0.14, y: 0.58 }, default: { x: 0.30, y: 0.58 } }, exits: [{ edge: 'west', to: 'starter_village', spawn: 'east' }], interactions: [], encounters: true,
  },
};
