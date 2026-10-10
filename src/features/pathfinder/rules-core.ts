import type { SheetValues } from './sheet-values';

export type Rank = 0 | 1 | 2 | 3 | 4;
export const RANK_LABELS = ['Необученный', 'Обученный', 'Эксперт', 'Мастер', 'Легенда'] as const;
export const RANK_MARKS = ['—', 'О', 'Э', 'М', 'Л'] as const;
export const SKILL_ABILITIES = {
  acrobatics: 'dex',
  athletics: 'str',
  thievery: 'dex',
  survival: 'wis',
  diplomacy: 'cha',
  intimidation: 'cha',
  lore1: 'int',
  lore2: 'int',
  performance: 'cha',
  medicine: 'wis',
  arcana: 'int',
  deception: 'cha',
  society: 'int',
  occultism: 'int',
  nature: 'wis',
  religion: 'wis',
  crafting: 'int',
  stealth: 'dex',
} as const;

export const SAVE_ABILITIES = { fort: 'con', reflex: 'dex', will: 'wis' } as const;
export const ARMOR_PENALTY_SKILLS = ['acrobatics', 'athletics', 'thievery', 'stealth'] as const;
const penalties = new Set<string>(ARMOR_PENALTY_SKILLS);

export const RANK_FIELDS = new Set([
  ...Object.keys(SKILL_ABILITIES).map(id => 'skill_' + id + '_rank'),
  ...Object.keys(SAVE_ABILITIES).map(id => 'save_' + id + '_rank'),
  'perception_rank',
  ...Array.from({ length: 4 }, (_, i) => 'armor_rank_' + i),
  ...Array.from({ length: 5 }, (_, i) => 'weapon_rank_' + i),
  'spell_attack_rank',
  'spell_dc_rank',
]);

/** Reject partial input, non-finite values and accidental prose in numeric cells. */
export function readNumber(v: unknown): number | undefined {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const text = String(v).trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && Math.abs(n) <= 100000 ? n : undefined;
}
export function readRank(v: unknown): Rank | undefined {
  const n = readNumber(v);
  return n !== undefined && Number.isInteger(n) && n >= 0 && n <= 4 ? n as Rank : undefined;
}
export function proficiencyBonus(level: number, rank: Rank): number {
  return rank === 0 ? 0 : level + rank * 2;
}
export function isLevel(value: unknown): number | undefined {
  const level = readNumber(value);
  return level !== undefined && Number.isInteger(level) && level >= 1 && level <= 20 ? level : undefined;
}
function signed(value: number): string { return value > 0 ? '+' + value : String(value); }

/**
 * Only stable, rules-derived field IDs. No CSS/layout or template coordinates.
 * Automatic mode never guesses a missing ability score. Empty ability => empty derived total.
 * PF2e typed bonus stacking, armor STR thresholds and exceptions are later patches.
 */
export function calculateCore(values: SheetValues): Record<string, string> {
  const result: Record<string, string> = {};
  const level = isLevel(values.level);
  if (level === undefined) return result;

  const ability = (key: string) => readNumber(values['ability_' + key]);
  const prof = (id: string): number | undefined => {
    const rank = readRank(values[id]);
    return proficiencyBonus(level, rank ?? 0);
  };
  const set = (id: string, n: number | undefined) => {
    if (n !== undefined && Number.isFinite(n)) result[id] = signed(n);
  };
  for (const [skill, key] of Object.entries(SKILL_ABILITIES)) {
    const prefix = 'skill_' + skill + '_';
    const abilityValue = ability(key);
    const proficiency = prof(prefix + 'rank');
    set(prefix + 'prof', proficiency);
    set(prefix + 'ability', abilityValue);
    if (abilityValue === undefined || proficiency === undefined) continue;
    const item = readNumber(values[prefix + 'item']) ?? 0;
    // Accept both "-2" and "2" in an armor penalty cell.
    const armor = penalties.has(skill) ? Math.abs(readNumber(values[prefix + 'armor']) ?? 0) : 0;
    set(prefix + 'total', abilityValue + proficiency + item - armor);
  }
  for (const [save, key] of Object.entries(SAVE_ABILITIES)) {
    const prefix = 'save_' + save + '_';
    const abilityValue = ability(key);
    const proficiency = prof(prefix + 'rank');
    set(prefix + 'prof', proficiency);
    set(prefix + 'ability', abilityValue);
    if (abilityValue === undefined || proficiency === undefined) continue;
    set('save_' + save, abilityValue + proficiency + (readNumber(values[prefix + 'item']) ?? 0));
  }
  const wisdom = ability('wis');
  const perceptionProf = prof('perception_rank');
  set('perception_prof', perceptionProf);
  set('perception_ability', wisdom);
  if (wisdom !== undefined && perceptionProf !== undefined)
    set('perception', wisdom + perceptionProf + (readNumber(values.perception_item) ?? 0));
  return result;
}
export function isAutomatic(values: SheetValues, legacyHasValues: boolean): boolean {
  if (values.rulesMode === 'auto') return true;
  if (values.rulesMode === 'manual') return false;
  return !legacyHasValues;
}
export function isCoreComputedField(id: string): boolean {
  return id === 'perception' || id === 'perception_prof' || id === 'perception_ability'
    || /^save_(fort|reflex|will)(?:_(prof|ability))?$/.test(id)
    || /^skill_[a-z0-9]+_(total|ability|prof)$/.test(id);
}
