import type { MinariData } from '../types/minari';

export const MINARI_ROSTER: Record<string, MinariData> = {
  flarepaw: {
    id: 'flarepaw',
    name: 'Flarepaw',
    element: 'fire',
    rarity: 'rare',
    stats: {
      maxHp: 320,
      hp: 320,
      maxAura: 200,
      aura: 200,
      power: 72,
      defense: 58,
      speed: 85,
      jumpPower: 600,
      weight: 70,
      soulbond: 0,
      maxSoulbond: 100
    },
    coreAttackId: 'flarepaw_core',
    specialSlots: ['ember_claws', 'blaze_charge', 'flame_vortex', 'flame_guard'],
    abilityId: 'magmaforge',
    ultimateId: 'magma_palm_barrage',
    colorPrimary: 0xff5500,
    colorSecondary: 0x1a1a1a,
    bodyShape: 'rect',
    bodyWidth: 48,
    bodyHeight: 64
  },
  droplet: {
    id: 'droplet',
    name: 'Droplet',
    element: 'water',
    rarity: 'uncommon',
    stats: {
      maxHp: 280,
      hp: 280,
      maxAura: 220,
      aura: 220,
      power: 60,
      defense: 55,
      speed: 90,
      jumpPower: 650,
      weight: 60,
      soulbond: 0,
      maxSoulbond: 100
    },
    coreAttackId: 'droplet_core',
    specialSlots: ['aqua_splash', 'bubble_dance', 'frost_pounce'],
    abilityId: '',
    ultimateId: '',
    colorPrimary: 0x0088dd,
    colorSecondary: 0xaaddff,
    bodyShape: 'circle',
    bodyWidth: 44,
    bodyHeight: 44
  }
};
