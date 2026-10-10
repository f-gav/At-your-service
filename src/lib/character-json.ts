import type { Character, CharacterDetails, GameSystem } from './models';
import { normalizeDetails, normalizedName } from './models';

/** JSON is a transport format, never a source of authentication or ownership. */
export type CharacterExport = {
  system: 'Pathfinder' | 'DnD' | 'VtM';
  format: 'at-your-service-character';
  version: 1;
  character: { name: string; details: CharacterDetails };
};
const labels: Record<GameSystem, CharacterExport['system']> = {
  pf2e: 'Pathfinder', dnd5e: 'DnD', vtm5e: 'VtM',
};
const systems: Record<CharacterExport['system'], GameSystem> = {
  Pathfinder: 'pf2e', DnD: 'dnd5e', VtM: 'vtm5e',
};
export function exportCharacter(c: Character): CharacterExport {
  return { system: labels[c.system], format: 'at-your-service-character', version: 1,
    character: { name: c.name, details: normalizeDetails(c.details) } };
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function parseCharacterJson(source: string): {system: GameSystem; name: string; details: CharacterDetails} {
  if (source.length > 1024*1024) throw new Error('JSON слишком большой (максимум 1 МБ).');
  let data: unknown;
  try { data = JSON.parse(source); } catch { throw new Error('Файл не является корректным JSON.'); }
  if (!isPlainObject(data) || data.format !== 'at-your-service-character' || data.version !== 1 ||
      !Object.hasOwn(systems, String(data.system))) throw new Error('Неизвестный формат или версия листа.');
  const system = systems[data.system as CharacterExport['system']];
  if (system !== 'pf2e') throw new Error('Импорт для DnD и VtM появится позже. Пока поддерживается Pathfinder.');
  if (!isPlainObject(data.character) || typeof data.character.name !== 'string' ||
      !isPlainObject(data.character.details)) throw new Error('Некорректные данные персонажа.');
  const name = normalizedName(data.character.name);
  if (!name || name !== data.character.name.trim()) throw new Error('Имя персонажа должно содержать от 1 до 100 символов.');
  const details = normalizeDetails(data.character.details);
  if (JSON.stringify(details).length > 50000) throw new Error('Данные листа превышают допустимый размер.');
  const sheet = details.pathfinderSheet;
  if (sheet !== undefined && !isPlainObject(sheet)) throw new Error('Некорректные поля Pathfinder.');
  return { system, name, details };
}
export function downloadCharacter(c: Character): void {
  const json = JSON.stringify(exportCharacter(c), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = c.name.replace(/[^A-Za-zА-Яа-яЁё0-9 _-]/g, '_').trim().slice(0,60) || 'character';
  link.href = url;
  link.download = safeName + '-PF2e'.replace('PF2e',c.system==='pf2e'?'PF2e':c.system==='dnd5e'?'DnD':'VtM')+'.json';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
