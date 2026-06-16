import type { Taxonomy, TaxonomyEntry } from './codexTypes';

export const TAXONOMY_REGISTRY: Record<Taxonomy, TaxonomyEntry> = {
  Wisp: {
    id: 'Wisp',
    description: 'Ghost-like, floating, spirit-bodied, or ethereal Monari.',
    commonTraits: ['Floating Body', 'Soul Flame', 'Orb Form', 'Intangible Body', 'Illusion Movement'],
  },
  Drake: {
    id: 'Drake',
    description: 'Dragon-like, scaled, serpentine, winged, or reptilian Monari.',
    commonTraits: ['Claws', 'Horns', 'Wings', 'Breath Attacks', 'Scales', 'Tails'],
  },
  Feral: {
    id: 'Feral',
    description: 'Beast-like animal Monari with mammal, quadruped, pawed, clawed, fanged, furred, antlered, or tailed bodies.',
    commonTraits: ['Mammal Body', 'Quadruped', 'Paws', 'Claws', 'Fangs', 'Fur', 'Antlers', 'Tails'],
  },
  Sylph: {
    id: 'Sylph',
    description: 'Fairy-like, delicate, magical, nature-like, or spirit-like Monari.',
    commonTraits: ['Tiny Body', 'Wings', 'Glowing Particles', 'Graceful Movement', 'Magical Aura'],
  },
  Golem: {
    id: 'Golem',
    description: 'Construct, armored, mineral, behemoth, or heavy-body Monari.',
    commonTraits: ['Stone Body', 'Crystal Armor', 'Metal Plates', 'Lava Shells', 'Huge Defense'],
  },
  Seraph: {
    id: 'Seraph',
    description: 'Angelic, celestial, radiant, divine, or humanoid-winged Monari.',
    commonTraits: ['Halos', 'Wings', 'Radiant Markings', 'Holy Aura', 'Elegant Humanoid Forms'],
  },
  Brute: {
    id: 'Brute',
    description: 'Strong humanoid fighter Monari built around physical dominance.',
    commonTraits: ['Fists', 'Bipedal Stance', 'Martial Arts', 'Muscular Body', 'Physical Dominance'],
  },
  Tempest: {
    id: 'Tempest',
    description: 'Bird-like, winged, aerial, fast, wind-based, or storm-based tactical Monari.',
    commonTraits: ['Feathers', 'Wings', 'Beaks', 'Talons', 'Gliding', 'Aerial Movement'],
  },
  Chitin: {
    id: 'Chitin',
    description: 'Insectoid, arachnid, exoskeleton, hive, spider, beetle, mantis, scorpion, or shell-bodied Monari.',
    commonTraits: ['Multiple Legs', 'Exoskeleton', 'Webs', 'Hive Body', 'Shell Body', 'Wall-Crawling'],
  },
  Astral: {
    id: 'Astral',
    description: 'Alien, cosmic, psychic, ethereal-biological, celestial-biological, mysterious, or otherworldly Monari.',
    commonTraits: ['Alien Body', 'Cosmic Markings', 'Psychic Aura', 'Ethereal Body', 'Floating', 'Unknown Origin'],
  },
};

export const OFFICIAL_TAXONOMIES = Object.keys(TAXONOMY_REGISTRY) as Taxonomy[];
