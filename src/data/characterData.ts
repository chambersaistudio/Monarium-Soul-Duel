export interface CharacterProfile {
  id: 'amari' | 'renzo' | 'vale';
  displayName: string;
  fullTitle?: string;
  role: string;
}

export const CHARACTERS: Record<CharacterProfile['id'], CharacterProfile> = {
  amari: { id: 'amari', displayName: 'Amari', role: 'Bonder' },
  renzo: { id: 'renzo', displayName: 'Renzo', role: 'Bonder Rival' },
  vale: {
    id: 'vale',
    displayName: 'Bondkeeper Vale',
    fullTitle: 'Head Bondkeeper Aureon Vale',
    role: 'Head Bondkeeper'
  }
};
