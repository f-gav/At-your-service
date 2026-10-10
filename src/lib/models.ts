export const GAME_SYSTEMS = {
  dnd5e: {
    short: 'D&D',
    edition: '5th Edition',
    title: 'Dungeons & Dragons',
    subtitle: 'Пятая редакция',
    code: '01',
    description: 'Герои, заклинания и приключения.',
  },
  pf2e: {
    short: 'PF2e',
    edition: 'Remaster',
    title: 'Pathfinder',
    subtitle: 'Вторая редакция · Remaster',
    code: '02',
    description: 'Истории, где решает каждая деталь.',
  },
  vtm5e: {
    short: 'VtM',
    edition: '5th Edition',
    title: 'Vampire: The Masquerade',
    subtitle: 'Пятая редакция',
    code: '03',
    description: 'Личности, тайны и ночные хроники.',
  },
} as const;

export type GameSystem = keyof typeof GAME_SYSTEMS;
export const systemKeys = Object.keys(GAME_SYSTEMS) as GameSystem[];

export type CharacterDetails = {
  concept?: string;
  chronicle?: string;
  notes?: string;
  // Specific, freely editable character-sheet fields will be added here later.
  [key: string]: unknown;
};

export type Character = {
  id: string;
  user_id: string;
  system: GameSystem;
  name: string;
  details: CharacterDetails;
  created_at: string;
  updated_at: string;
  sort_order: number;
};

export const defaultDetails = (): CharacterDetails => ({ concept: '', chronicle: '', notes: '' });

export function normalizedName(name: string): string {
  return name.trim().slice(0, 100);
}

export function normalizeDetails(raw: unknown): CharacterDetails {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as CharacterDetails;
  }
  return defaultDetails();
}

export function detailString(details: CharacterDetails, key: keyof CharacterDetails): string {
  const value = details[key];
  return typeof value === 'string' ? value : '';
}

/** Move a character into the chosen list position without changing the other cards' relative order. */
export function moveCharacterToIndex<T extends { id: string }>(
  items: readonly T[], id: string, targetIndex: number,
): T[] {
  const fromIndex = items.findIndex(item => item.id === id);
  if (fromIndex < 0 || targetIndex < 0 || targetIndex >= items.length || fromIndex === targetIndex) {
    return [...items];
  }
  const reordered = [...items];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  return reordered;
}
