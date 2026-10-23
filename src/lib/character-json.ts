import type { Character, CharacterDetails, GameSystem } from './models';
import { normalizeDetails, normalizedName } from './models';
import { portraitToJson, parsePortraitTransfer } from '../features/portrait/portrait-json';
import type { PortraitTransfer, ParsedPortrait } from '../features/portrait/portrait-json';

/**
 * JSON v2 is an exchange format, not the mutable database layout.
 * The PF2e application still uses stable field IDs internally; conversion at
 * the boundary keeps historical saves and future template fields compatible.
 */
export type CharacterExport = {
  system: 'Pathfinder' | 'DnD' | 'VtM' | 'Project Moon';
  format: 'at-your-service-character';
  version: 2;
  character: {
    name: string;
    details: CharacterDetails;
    sheet?: Record<string, unknown>;
    portrait?: PortraitTransfer;
  };
};
const labels: Record<GameSystem, CharacterExport['system']> = {
  pf2e: 'Pathfinder', dnd5e: 'DnD', vtm5e: 'VtM', prmoon: 'Project Moon',
};
const systems: Record<CharacterExport['system'], GameSystem> = {
  Pathfinder: 'pf2e', DnD: 'dnd5e', VtM: 'vtm5e', 'Project Moon': 'prmoon',
};
const PF_SPELL_KEYS = [
  'pf_spell_display_mode', 'pf_spell_library_selection',
  'pf_spell_library_layout_v1', 'pf_spell_available_classes',
  'pf_spell_available_traditions',
] as const;
const PF_PAGE_KEYS = ['pf2e_layout', 'pf2e_page_order', 'pf2e_notes_enabled'] as const;
// These fields were the original hand-written spell tables. In library mode
// their content is not rendered: the spell IDs and layout are authoritative.
// Never remove them from a character's cloud save or from text-mode exports.
const LEGACY_SPELL_TABLE = /^(?:cantrip_(?:names|actions|prepared)|focus_(?:spells|actions)|innate_(?:spells|actions|frequency)|spellbook_(?:left|right)_(?:names|actions|ranks|prepared)|rituals_(?:left|right)_(?:name|rank|cost))$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function savedSpells(raw: unknown): { id: string; prepared: boolean }[] {
  const seen = new Set<string>();
  return jsonArray(raw).filter((row): row is {id:string;prepared:boolean} =>
    isPlainObject(row) && typeof row.id === 'string' && row.id.length > 0 &&
    row.id.length <= 130 && typeof row.prepared === 'boolean'
  ).filter(row => {
    if (seen.has(row.id)) return false;
    seen.add(row.id); return true;
  }).map(row => ({ id: row.id, prepared: row.prepared }));
}
function spellLayout(raw: unknown, selection: {id:string;prepared:boolean}[]): Record<string,unknown> | undefined {
  let decoded: unknown = raw;
  if (typeof raw === 'string') {
    try { decoded = JSON.parse(raw); } catch { return undefined; }
  }
  if (!isPlainObject(decoded) || decoded.version !== 1 || !Array.isArray(decoded.items)) return undefined;
  const visible = new Set(selection.filter(row => row.prepared).map(row => row.id));
  const seen = new Set<string>();
  const items: Record<string,unknown>[] = [];
  for (const item of decoded.items.slice(0,600)) {
    if (!isPlainObject(item) || typeof item.id !== 'string' || seen.has(item.id) ||
        typeof item.zone !== 'string') continue;
    if (item.kind === 'spell') {
      if (!visible.has(item.id)) continue; // Remove obsolete/unselected positions.
      items.push({kind:'spell', id:item.id, zone:item.zone});
    } else if (item.kind === 'divider' && item.id.startsWith('divider:')) {
      items.push({kind:'divider',id:item.id,zone:item.zone,title:typeof item.title==='string'?item.title:''});
    } else continue;
    seen.add(item.id);
  }
  return {version:1,items};
}

/** Convert one PF2e save to groups without retaining duplicate UI-era tables. */
export function packPathfinderSheet(source: unknown): Record<string, unknown> {
  const stored = isPlainObject(source) ? source : {};
  const selection = savedSpells(stored.pf_spell_library_selection);
  const mode = stored.pf_spell_display_mode === 'text' ? 'text' : 'library';
  const hasLibrary = typeof stored.pf_spell_library_selection === 'string' ||
    typeof stored.pf_spell_library_layout_v1 === 'string';
  const excluded = new Set<string>(['name','schemaVersion',...PF_SPELL_KEYS,...PF_PAGE_KEYS]);
  const fields: Record<string, unknown> = {};
  for (const [key,value] of Object.entries(stored)) {
    if (excluded.has(key)) continue;
    if (mode === 'library' && hasLibrary && LEGACY_SPELL_TABLE.test(key)) continue;
    fields[key] = value; // Preserve active custom template fields, even future IDs.
  }
  const page: Record<string, unknown> = {};
  if (stored.pf2e_layout !== undefined) page.layout = stored.pf2e_layout;
  if (stored.pf2e_page_order !== undefined) page.order = stored.pf2e_page_order;
  if (stored.pf2e_notes_enabled !== undefined) page.notesEnabled = stored.pf2e_notes_enabled;
  const spells: Record<string, unknown> = { mode, selection };
  const layout = spellLayout(stored.pf_spell_library_layout_v1, selection);
  if (layout) spells.layout = layout;
  if (stored.pf_spell_available_classes !== undefined)
    spells.classes = jsonArray(stored.pf_spell_available_classes);
  if (stored.pf_spell_available_traditions !== undefined)
    spells.traditions = jsonArray(stored.pf_spell_available_traditions);
  return { fields, page, spells };
}

function unpackPathfinderSheet(source: unknown, characterName: string): Record<string, unknown> {
  if (!isPlainObject(source) || !isPlainObject(source.fields)) throw new Error('Некорректные поля Pathfinder JSON v2.');
  const fields = { ...source.fields };
  const forbidden = new Set<string>(['name','schemaVersion',...PF_SPELL_KEYS,...PF_PAGE_KEYS]);
  for (const key of forbidden) delete fields[key];
  if (source.page !== undefined && !isPlainObject(source.page)) throw new Error('Некорректные страницы Pathfinder.');
  if (source.spells !== undefined && !isPlainObject(source.spells)) throw new Error('Некорректные заклинания Pathfinder.');
  const page = isPlainObject(source.page) ? source.page : {};
  const spells = isPlainObject(source.spells) ? source.spells : {};
  const mode = spells.mode === 'text' ? 'text' : 'library';
  const selection = savedSpells(spells.selection);
  const result: Record<string, unknown> = { ...fields, name:characterName, schemaVersion:1 };
  if (page.layout !== undefined) result.pf2e_layout = page.layout;
  if (page.order !== undefined) result.pf2e_page_order = page.order;
  if (page.notesEnabled !== undefined) result.pf2e_notes_enabled = page.notesEnabled;
  result.pf_spell_display_mode = mode;
  result.pf_spell_library_selection = JSON.stringify(selection);
  const layout = spellLayout(spells.layout, selection);
  if (layout) result.pf_spell_library_layout_v1 = JSON.stringify(layout);
  if (spells.classes !== undefined) {
    if (!Array.isArray(spells.classes)) throw new Error('Некорректные классы заклинаний.');
    result.pf_spell_available_classes = JSON.stringify(spells.classes);
  }
  if (spells.traditions !== undefined) {
    if (!Array.isArray(spells.traditions)) throw new Error('Некорректные традиции заклинаний.');
    result.pf_spell_available_traditions = JSON.stringify(spells.traditions);
  }
  return result;
}
export function exportCharacter(c: Character): CharacterExport {
  const details: CharacterDetails = { ...normalizeDetails(c.details) };
  let sheet: Record<string,unknown> | undefined;
  if (c.system === 'pf2e') {
    sheet = packPathfinderSheet(details.pathfinderSheet);
    delete details.pathfinderSheet;
  } else if (c.system === 'prmoon') {
    sheet = isPlainObject(details.projectMoonSheet) ? {...details.projectMoonSheet} : {};
    delete details.projectMoonSheet;
  }
  return {system:labels[c.system],format:'at-your-service-character',version:2,
    character:{name:c.name,details,...(sheet?{sheet}:{})}};
}
export function parseCharacterJson(source: string): {system: GameSystem; name: string; details: CharacterDetails; portrait?: ParsedPortrait} {
  if (source.length > 2*1024*1024) throw new Error('JSON слишком большой (максимум 2 МБ).');
  let data: unknown;
  try { data = JSON.parse(source); } catch { throw new Error('Файл не является корректным JSON.'); }
  if (!isPlainObject(data) || data.format !== 'at-your-service-character' ||
      (data.version !== 1 && data.version !== 2) ||
      !Object.hasOwn(systems, String(data.system))) throw new Error('Неизвестный формат или версия листа.');
  const system = systems[data.system as CharacterExport['system']];
  if (system !== 'pf2e' && system !== 'prmoon') throw new Error('Импорт для DnD и VtM появится позже.');
  if (!isPlainObject(data.character) || typeof data.character.name !== 'string' ||
      !isPlainObject(data.character.details)) throw new Error('Некорректные данные персонажа.');
  const name = normalizedName(data.character.name);
  if (!name || name !== data.character.name.trim()) throw new Error('Имя персонажа должно содержать от 1 до 100 символов.');
  const details: CharacterDetails = {...normalizeDetails(data.character.details)};
  if (data.version === 2) {
    // The transfer schema is the only v2 source of sheet state. A stray legacy
    // pathfinderSheet in common details must never override grouped values.
    if (system === 'pf2e') {
      delete details.pathfinderSheet;
      details.pathfinderSheet = unpackPathfinderSheet(data.character.sheet, name);
    } else {
      if (!isPlainObject(data.character.sheet)) throw new Error('Некорректный лист Project Moon JSON v2.');
      delete details.projectMoonSheet;
      details.projectMoonSheet = {...data.character.sheet};
    }
  }
  if (JSON.stringify(details).length > 50000) throw new Error('Данные листа превышают допустимый размер.');
  const sheet = details.pathfinderSheet;
  if (sheet !== undefined && !isPlainObject(sheet)) throw new Error('Некорректные поля Pathfinder.');
  const moon = details.projectMoonSheet;
  if (system === 'prmoon' && moon !== undefined && !isPlainObject(moon)) throw new Error('Некорректные поля Project Moon.');
  const portrait = parsePortraitTransfer(data.character.portrait);
  return { system, name, details, portrait };
}
export async function downloadCharacter(c: Character): Promise<void> {
  const exported = exportCharacter(c);
  const portrait = await portraitToJson(c);
  if (portrait) exported.character.portrait = portrait;
  const json = JSON.stringify(exported, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = c.name.replace(/[^A-Za-zА-Яа-яЁё0-9 _-]/g, '_').trim().slice(0,60) || 'character';
  link.href = url;
  link.download = safeName + '-' + (c.system === 'pf2e' ? 'PF2e' : c.system === 'dnd5e' ? 'DnD' : c.system === 'prmoon' ? 'PrMoon' : 'VtM') + '.json';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
