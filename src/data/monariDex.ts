import type { MonariDexEntry } from '../types/monari';

export const STARTER_MONARI: MonariDexEntry[] = [
  {
    id: 'flarepaw',
    name: 'Flarepaw',
    element: 'Ember',
    rarity: 'Rare',
    level: 7,
    role: 'Hybrid striker',
    baseStats: { hp: 52, aura: 58, attack: 62, specialAttack: 70, defense: 42, specialDefense: 45, speed: 60 }
  },
  {
    id: 'droplet',
    name: 'Droplet',
    element: 'Aqua',
    rarity: 'Rare',
    level: 7,
    role: 'Physical bruiser',
    baseStats: { hp: 60, aura: 48, attack: 72, specialAttack: 44, defense: 58, specialDefense: 48, speed: 36 }
  },
  {
    id: 'sproutodon',
    name: 'Sproutodon',
    element: 'Terra',
    rarity: 'Rare',
    level: 7,
    role: 'Bulky guardian',
    baseStats: { hp: 68, aura: 52, attack: 48, specialAttack: 52, defense: 70, specialDefense: 68, speed: 28 }
  }
];

export const STARTER_ADVANTAGE: Record<string, string> = {
  flarepaw: 'droplet',
  droplet: 'sproutodon',
  sproutodon: 'flarepaw'
};

export function getStarter(id: string): MonariDexEntry {
  return STARTER_MONARI.find(monari => monari.id === id) ?? STARTER_MONARI[0];
}

export function getRenzoStarter(playerStarterId: string): MonariDexEntry {
  return getStarter(STARTER_ADVANTAGE[playerStarterId] ?? 'droplet');
}
