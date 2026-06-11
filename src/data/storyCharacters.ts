export interface StoryCharacterDef {
  id: 'player' | 'renzo' | 'warren_ellis';
  name: string;
  assets: {
    portrait?: string;
    overworld?: string;
    fullBody?: string;
  };
  displayHeight: number;
}

export const STORY_CHARACTERS: Record<StoryCharacterDef['id'], StoryCharacterDef> = {
  player: {
    id: 'player',
    name: 'Corn',
    assets: {
      portrait: 'assets/characters/player/portraits/neutral.png',
      overworld: 'assets/characters/player/overworld/fullbody.png',
      fullBody: 'assets/characters/player/reference/fullbody.png',
    },
    displayHeight: 132,
  },
  renzo: {
    id: 'renzo',
    name: 'Renzo',
    assets: {
      portrait: 'assets/characters/renzo/portraits/neutral.png',
      overworld: 'assets/characters/renzo/overworld/fullbody.png',
      fullBody: 'assets/characters/renzo/reference/fullbody.png',
    },
    displayHeight: 136,
  },
  warren_ellis: {
    id: 'warren_ellis',
    name: 'Dr. Warren Ellis',
    assets: {
      portrait: 'assets/characters/warren_ellis/portraits/neutral.png',
      fullBody: 'assets/characters/warren_ellis/reference/fullbody.png',
    },
    displayHeight: 140,
  },
};
