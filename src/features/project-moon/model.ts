import type { CharacterDetails } from '../../lib/models';
import { DEFAULT_MOON_ORDER, parseMoonOrder } from './page-order.ts';

export const MOON_PAGES = [
  { id: 'dossier', title: 'Досье' },
  { id: 'combat', title: 'Боевое досье' },
  { id: 'about', title: 'Обо мне' },
  { id: 'notes', title: 'Заметки' },
] as const;
export type MoonPage = typeof MOON_PAGES[number]['id'];

export const MOON_ATTRIBUTES = [
  { id: 'fortitude', label: 'Стойкость', english: 'FORTITUDE' },
  { id: 'prudence', label: 'Рассудительность', english: 'PRUDENCE' },
  { id: 'determination', label: 'Решительность', english: 'JUSTICE' },
  { id: 'charm', label: 'Обаяние', english: 'CHARM' },
  { id: 'discernment', label: 'Проницательность', english: 'INSIGHT' },
  { id: 'temperance', label: 'Самообладание', english: 'TEMPERANCE' },
] as const;

export type MoonResourceId = 'hp' | 'st' | 'sp' | 'light';
export type MoonItem = { id: string; title: string; body: string; rank?: string; light?: string; ep?: string; type?: string };
export type MoonWeapon = { id: string; name: string; dice: string; bonus: string; description: string; rank?: string; ep?: string; kind?: string; damage?: string; form?: string; grip?: string };
export type MoonSheetData = {
  schemaVersion: 1;
  fields: Record<string, string>;
  autoVitals: boolean;
  smoothWeaponSwitch: boolean;
  inventoryColumns: number;
  textSizes: Record<string, number>;
  pageOrder: MoonPage[];
  maxOverrides: Partial<Record<MoonResourceId, string>>;
  weapons: MoonWeapon[];
  skills: MoonItem[];
  notes: MoonItem[];
};

const text = (value: unknown): string => typeof value === 'string' ? value : '';
export const newMoonItem = (id: string): MoonItem => ({ id, title: '', body: '' });
export const newMoonWeapon = (id: string): MoonWeapon => ({ id, name: '', dice: '', bonus: '', description: '' });

export function emptyMoonSheet(): MoonSheetData {
  return {
    schemaVersion: 1,
    fields: {},
    autoVitals: false,
    smoothWeaponSwitch: true,
    inventoryColumns: 1,
    textSizes: {},
    pageOrder: [...DEFAULT_MOON_ORDER],
    maxOverrides: {},
    weapons: [newMoonWeapon('weapon-1'), newMoonWeapon('weapon-2')],
    skills: Array.from({ length: 6 }, (_, index) => newMoonItem('skill-' + (index + 1))),
    notes: Array.from({ length: 6 }, (_, index) => newMoonItem('note-' + (index + 1))),
  };
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const item = (raw: unknown, fallbackId: string): MoonItem => {
  const r = record(raw);
  return { id: text(r.id) || fallbackId, title: text(r.title), body: text(r.body),
    rank: text(r.rank), light: text(r.light), ep: text(r.ep), type: text(r.type) };
};
const weapon = (raw: unknown, fallbackId: string): MoonWeapon => {
  const r = record(raw);
  return { id: text(r.id) || fallbackId, name: text(r.name), dice: text(r.dice),
    bonus: text(r.bonus), description: text(r.description), rank: text(r.rank), ep: text(r.ep),
    kind: text(r.kind), damage: text(r.damage), form: text(r.form), grip: text(r.grip) };
};

export function readMoonSheet(details: CharacterDetails): MoonSheetData {
  const stored = record(details.projectMoonSheet);
  const initial = emptyMoonSheet();
  const fields = record(stored.fields);
  const overrides = record(stored.maxOverrides);
  const readItems = (value: unknown, fallback: MoonItem[], idPrefix: 'skill' | 'note') => Array.isArray(value)
    ? value.slice(0, 100).map((entry, index) => item(entry, idPrefix + '-' + (index + 1))) : fallback;
  return {
    schemaVersion: 1,
    fields: Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] =>
      typeof entry[1] === 'string')),
    autoVitals: stored.autoVitals === true,
    smoothWeaponSwitch: stored.smoothWeaponSwitch !== false,
    textSizes: Object.fromEntries(Object.entries(record(stored.textSizes))
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] >= 8 && entry[1] <= 28)),
    inventoryColumns: typeof stored.inventoryColumns === 'number' && Number.isInteger(stored.inventoryColumns)
      ? Math.max(1, Math.min(4, stored.inventoryColumns)) : 1,
    pageOrder: parseMoonOrder(stored.pageOrder),
    maxOverrides: Object.fromEntries(['hp','st','sp','light']
      .filter(key => typeof overrides[key] === 'string')
      .map(key => [key, overrides[key] as string])),
    weapons: Array.isArray(stored.weapons)
      ? stored.weapons.slice(0, 100).map((entry, index) => weapon(entry, 'weapon-' + (index + 1)))
        .concat(initial.weapons.slice(Math.min(stored.weapons.length, 2)))
      : initial.weapons,
    skills: readItems(stored.skills, initial.skills, 'skill'),
    notes: readItems(stored.notes, initial.notes, 'note'),
  };
}

export function saveMoonSheet(details: CharacterDetails, sheet: MoonSheetData): CharacterDetails {
  // Preserve other systems' data and any future projectMoonSheet extensions.
  const previous = record(details.projectMoonSheet);
  return { ...details, projectMoonSheet: { ...previous, ...sheet } };
}

export function moonSubtitle(details: CharacterDetails): string {
  const fields = readMoonSheet(details).fields;
  return [fields.occupation, fields.organization].filter(Boolean).join(' · ') || 'Занятие / Организация';
}

function numeric(source: string | undefined): number | null {
  if (!source || !/^-?\d+$/.test(source.trim())) return null;
  const value = Number(source);
  return Number.isSafeInteger(value) ? value : null;
}

export function moonCalculatedMax(sheet: MoonSheetData, id: MoonResourceId): number | null {
  const fields = sheet.fields;
  const rank = numeric(fields.rank);
  if (id === 'light') return rank === null ? null : 3 + rank;
  if (!sheet.autoVitals) return null;
  const value = numeric(fields[id === 'hp' ? 'fortitude' : id === 'st' ? 'charm' : 'prudence']);
  if (value === null) return null;
  if (id === 'hp') return rank === null ? null : 64 + 8 * value + 32 * rank;
  if (id === 'st') return rank === null ? null : 20 + 4 * value + 4 * rank;
  return 15 + 3 * value;
}

export function moonDisplayedMax(sheet: MoonSheetData, id: MoonResourceId): string {
  const computed = moonCalculatedMax(sheet, id);
  if (computed !== null) return sheet.maxOverrides[id] ?? String(computed);
  return sheet.fields[id + 'Max'] ?? '';
}

export function moonAttackBonus(sheet: MoonSheetData): string {
  const rank = numeric(sheet.fields.rank);
  if (rank === null) return '';
  return rank < 0 ? String(rank) : '+' + rank;
}

/** Rulebook 3.x resistance tiers. Pure helper for an optional preview;
 * never mutates HP, ST, status or character data.
 */
export const MOON_RESISTANCE_TIERS = [
  { label: 'Fatal', multiplier: 2 },
  { label: 'Weak', multiplier: 1.5 },
  { label: 'Normal', multiplier: 1 },
  { label: 'Endured', multiplier: 0.5 },
  { label: 'Ineffective', multiplier: 0.25 },
  { label: 'Immune', multiplier: 0 },
] as const;

export function moonResistanceMultiplier(raw: string): number | null {
  const text = raw.trim().replace(',', '.').toLowerCase();
  if (!text) return null;
  const tier = MOON_RESISTANCE_TIERS.find(entry => entry.label.toLowerCase() === text);
  if (tier) return tier.multiplier;
  // Accept previously entered multipliers such as 'x1.5', '1.5' or '×0.5'.
  const plain = text.replace(/^[x×]/, '').trim();
  if (!/^(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(plain)) return null;
  const value = Number(plain);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function moonDamageEstimate(finalResult: string, resistance: string, afterResistance = ''): number | null {
  const resultText = finalResult.trim().replace(',', '.');
  const afterText = afterResistance.trim().replace(',', '.');
  if (!/^(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(resultText)) return null;
  if (afterText && !/^-?(?:\\d+(?:\\.\\d+)?|\\.\\d+)$/.test(afterText)) return null;
  const modifier = moonResistanceMultiplier(resistance);
  if (modifier === null) return null;
  const damage = Number(resultText) * modifier + (afterText ? Number(afterText) : 0);
  return Number.isFinite(damage) ? Math.max(0, damage) : null;
}

export function addMoonSkill(sheet: MoonSheetData, id: string): MoonSheetData {
  return { ...sheet, skills: [...sheet.skills, newMoonItem(id)] };
}

export function addMoonWeapon(sheet: MoonSheetData, id: string): MoonSheetData {
  if (sheet.weapons.length >= 100) return sheet;
  return { ...sheet, weapons: [...sheet.weapons, newMoonWeapon(id)] };
}

/** Remove a chosen weapon but retain the two initial slots at minimum. */
export function removeMoonWeapon(sheet: MoonSheetData, id: string): MoonSheetData {
  if (sheet.weapons.length <= 2 || !sheet.weapons.some(weapon => weapon.id === id)) return sheet;
  return { ...sheet, weapons: sheet.weapons.filter(weapon => weapon.id !== id) };
}

/** Labels are A–Z then AA, AB…; stored weapon IDs remain independent of labels. */
export function moonWeaponLetter(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) { value--; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); }
  return label;
}
