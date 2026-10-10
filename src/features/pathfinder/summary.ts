import type { CharacterDetails } from '../../lib/models';

/** Home-card metadata is derived from the same PF2e fields as the sheet. */
export function pathfinderSubtitle(details: CharacterDetails): string {
  const stored = details.pathfinderSheet;
  const sheet = stored && typeof stored === 'object' && !Array.isArray(stored)
    ? stored as Record<string, unknown> : {};
  const ancestry = typeof sheet.ancestry === 'string' ? sheet.ancestry.trim() : '';
  const characterClass = typeof sheet.character_class === 'string' ? sheet.character_class.trim() : '';
  return `${ancestry || 'Народ'} - ${characterClass || 'Класс'}`;
}
