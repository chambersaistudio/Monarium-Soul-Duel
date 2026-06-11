export type StoryElement = 'fire' | 'water' | 'flora';
export type StoryGender = 'male' | 'female';

export interface StoryMonariDef {
  id: 'flarepaw' | 'droplet' | 'sproutodon';
  name: string;
  element: StoryElement;
  elementLabel: string;
  elementIcon: string;
  role: string;
  description: string;
  assets: {
    profile?: string;
    fullBody?: string;
    overworld?: string;
    battleIdle: string;
  };
  stats: { hp: number; aura: number; soulSync: number; level: number };
}

export const STORY_MONARI: Record<StoryMonariDef['id'], StoryMonariDef> = {
  flarepaw: {
    id: 'flarepaw',
    name: 'Flarepaw',
    element: 'fire',
    elementLabel: 'Fire',
    elementIcon: 'assets/ui/elements/fire.png',
    role: 'Fast aggressive striker',
    description: 'A Fire element partner with quick pressure, brave instincts, and sharp opening attacks.',
    assets: {
      fullBody: 'assets/monari/flarepaw/reference/neutral.png',
      battleIdle: 'assets/monari/flarepaw/idle/frame_002.png',
    },
    stats: { hp: 99, aura: 51, soulSync: 70, level: 7 },
  },
  droplet: {
    id: 'droplet',
    name: 'Droplet',
    element: 'water',
    elementLabel: 'Water',
    elementIcon: 'assets/ui/elements/water.png',
    role: 'Balanced special style',
    description: 'A Water element partner with clean Aura control, flexible spacing, and balanced trades.',
    assets: {
      battleIdle: 'assets/monari/droplet/idle/frame_002.png',
    },
    stats: { hp: 92, aura: 58, soulSync: 70, level: 7 },
  },
  sproutodon: {
    id: 'sproutodon',
    name: 'Sproutodon',
    element: 'flora',
    elementLabel: 'Flora',
    elementIcon: 'assets/ui/elements/flora.png',
    role: 'Bulky guardian',
    description: 'A Flora element guardian with sturdy defenses, patient rhythm, and loyal protection.',
    assets: {
      profile: 'assets/monari/sproutodon/portraits/neutral.png',
      overworld: 'assets/monari/sproutodon/overworld/fullbody.png',
      fullBody: 'assets/monari/sproutodon/reference/fullbody.png',
      battleIdle: 'assets/monari/sproutodon/reference/battle_ref.png',
    },
    stats: { hp: 112, aura: 44, soulSync: 70, level: 7 },
  },
};

export function randomStoryGender(): StoryGender {
  return Math.random() < 0.63 ? 'male' : 'female';
}

export function renzoCounterPick(playerStarter: StoryMonariDef['id']): StoryMonariDef['id'] {
  if (playerStarter === 'flarepaw') return 'droplet';
  if (playerStarter === 'droplet') return 'sproutodon';
  return 'flarepaw';
}
