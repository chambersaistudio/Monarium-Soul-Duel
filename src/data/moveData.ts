import type { CoreAttackConfig, MoveData, FormData, UltimateData } from '../types/combat';

export const CORE_ATTACKS: Record<string, CoreAttackConfig> = {
  flarepaw_core: {
    id: 'flarepaw_core',
    name: 'Flaming Palm Strike',
    animKey: 'flarepaw_attack',
    comboHits: [
      {
        // frame_054 = startup, frame_055+056 = active hit, frame_058 = recovery
        // at 12fps each frame ≈ 83ms → startup≈5 ticks, active≈10 ticks, recovery≈5 ticks
        damage: 8,
        hitbox: { shape: 'rect', offsetX: 40, offsetY: 0, width: 50, height: 40 },
        startupFrames: 5,
        activeFrames: 10,
        recoveryFrames: 5,
        knockbackX: 80,
        knockbackY: -20
      },
      {
        damage: 10,
        hitbox: { shape: 'rect', offsetX: 45, offsetY: 0, width: 55, height: 40 },
        startupFrames: 4,
        activeFrames: 10,
        recoveryFrames: 6,
        knockbackX: 100,
        knockbackY: -30
      },
      {
        damage: 16,
        hitbox: { shape: 'rect', offsetX: 50, offsetY: 0, width: 65, height: 50 },
        startupFrames: 5,
        activeFrames: 10,
        recoveryFrames: 12,
        knockbackX: 200,
        knockbackY: -60
      }
    ],
    comboWindow: 500,
    cooldown: 300
  },
  droplet_core: {
    id: 'droplet_core',
    name: 'Aqua Swipe',
    animKey: 'droplet_swipe',
    comboHits: [
      {
        damage: 7,
        hitbox: { shape: 'rect', offsetX: 35, offsetY: -10, width: 60, height: 45 },
        startupFrames: 5,
        activeFrames: 7,
        recoveryFrames: 10,
        knockbackX: 90,
        knockbackY: -30
      }
    ],
    comboWindow: 400,
    cooldown: 400
  }
};

export const MOVES: Record<string, MoveData> = {
  ember_claws: {
    id: 'ember_claws',
    name: 'Ember Claws',
    description: 'Short-range fire combo raking the enemy.',
    category: 'melee',
    auraCost: 20,
    damage: 22,
    hitbox: { shape: 'rect', offsetX: 50, offsetY: 0, width: 70, height: 50 },
    startupFrames: 6,
    activeFrames: 10,
    recoveryFrames: 12,
    cooldown: 800,
    range: 'close',
    colorTint: 0xff6600
  },
  blaze_charge: {
    id: 'blaze_charge',
    name: 'Blaze Charge',
    description: 'Fast forward dash attack to close distance.',
    category: 'melee',
    auraCost: 35,
    damage: 28,
    hitbox: { shape: 'rect', offsetX: 60, offsetY: 0, width: 80, height: 55 },
    startupFrames: 4,
    activeFrames: 14,
    recoveryFrames: 18,
    cooldown: 1200,
    range: 'mid',
    colorTint: 0xff3300
  },
  flame_vortex: {
    id: 'flame_vortex',
    name: 'Flame Vortex',
    description: 'Mouth-based flame tornado projectile.',
    category: 'projectile',
    auraCost: 45,
    damage: 35,
    hitbox: { shape: 'circle', offsetX: 0, offsetY: 0, width: 30, height: 30 },
    startupFrames: 8,
    activeFrames: 60,
    recoveryFrames: 20,
    cooldown: 1500,
    projectileSpeed: 400,
    projectileType: 'linear',
    range: 'far',
    colorTint: 0xff4400
  },
  flame_guard: {
    id: 'flame_guard',
    name: 'Flame Guard',
    description: 'Fire aura shield — 60% damage reduction; burns enemies that hit Flarepaw.',
    category: 'buff',
    auraCost: 25,
    damage: 8,           // burn counter-damage returned to attacker on contact
    hitbox: { shape: 'circle', offsetX: 0, offsetY: 0, width: 60, height: 60 },
    startupFrames: 4,
    activeFrames: 1,
    recoveryFrames: 4,
    cooldown: 7000,
    buffDuration: 2000,  // 2 seconds active
    range: 'self',
    colorTint: 0xff8800
  },
  aqua_splash: {
    id: 'aqua_splash',
    name: 'Aqua Splash',
    description: 'Mid-range water projectile burst.',
    category: 'projectile',
    auraCost: 20,
    damage: 18,
    hitbox: { shape: 'circle', offsetX: 0, offsetY: 0, width: 28, height: 28 },
    startupFrames: 7,
    activeFrames: 50,
    recoveryFrames: 15,
    cooldown: 900,
    projectileSpeed: 380,
    projectileType: 'linear',
    range: 'far',
    colorTint: 0x00aaff
  },
  bubble_dance: {
    id: 'bubble_dance',
    name: 'Bubble Dance',
    description: 'Slowing bubble field that lingers on the arena.',
    category: 'projectile',
    auraCost: 35,
    damage: 12,
    hitbox: { shape: 'circle', offsetX: 0, offsetY: 0, width: 40, height: 40 },
    startupFrames: 10,
    activeFrames: 90,
    recoveryFrames: 18,
    cooldown: 1800,
    projectileSpeed: 200,
    projectileType: 'arc',
    buffDuration: 2000,
    range: 'mid',
    colorTint: 0x88ddff
  },
  frost_pounce: {
    id: 'frost_pounce',
    name: 'Frost Pounce',
    description: 'Leaping freeze attack that launches the enemy.',
    category: 'melee',
    auraCost: 30,
    damage: 25,
    hitbox: { shape: 'rect', offsetX: 40, offsetY: -20, width: 70, height: 60 },
    startupFrames: 5,
    activeFrames: 12,
    recoveryFrames: 20,
    cooldown: 1400,
    range: 'mid',
    colorTint: 0x00ccff
  }
};

export const FORMS: Record<string, FormData> = {
  magmaforge: {
    id: 'magmaforge',
    name: 'Magmaforge Form',
    displayText: 'Magmaforge Form Activated!',
    duration: 8000,
    auraPerSecond: 15,
    damageMult: 1.25,
    defenseMult: 0.9,
    speedMult: 1.1,
    glowColor: 0xff4400,
    activationCondition: 'soulbond',
    activationThreshold: 50
  }
};

export const ULTIMATES: Record<string, UltimateData> = {
  magma_palm_barrage: {
    id: 'magma_palm_barrage',
    name: 'Magma Palm Barrage',
    displayText: 'Magma Palm Barrage!',
    damage: 80,
    range: 300,
    soulbondCost: 100,
    pauseDuration: 1200
  }
};
