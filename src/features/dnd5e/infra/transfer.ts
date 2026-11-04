import type {CharacterDetails} from '../../../lib/models';
import {newDndSheet} from '../domain/model.ts';
import type {Dnd5eSheet} from '../domain/model.ts';
import {validateDndSheet} from '../domain/validation.ts';

/** The live characters.details CHECK enforces pg_column_size(details) <= 65536.
 * UTF-8 length is not identical to the PostgreSQL jsonb footprint. This
 * conservative preflight prevents common failures; the server remains final.
 * Never trim player data in order to pass the check.
 */
export const DND_SAFE_DETAILS_BYTES=48000;
export function assertDndDetailsBudget(details:CharacterDetails):void{
  const bytes=new TextEncoder().encode(JSON.stringify(details)).byteLength;
  if(bytes>DND_SAFE_DETAILS_BYTES)
    throw Error('D&D: данные листа превышают безопасный предел сохранения ('+bytes+' байт). Скачайте JSON; потребуется согласованное расширение хранилища.');
}
export function packDndSheet(value:unknown,name='Персонаж'):Dnd5eSheet{
  return validateDndSheet(value??newDndSheet(name));
}
export function unpackDndSheet(value:unknown):Dnd5eSheet{
  return validateDndSheet(value);
}
/** Preserve all non-D&D details and never mutate the previously saved record. */
export function prepareDndDetails(previous:CharacterDetails,sheet:Dnd5eSheet):CharacterDetails{
  const prepared={...previous,dnd5eSheet:validateDndSheet(sheet)};
  assertDndDetailsBudget(prepared);
  return prepared;
}
export function transferDndToAysV2(name:string,details:CharacterDetails){
  const clean={...details};
  const sheet=packDndSheet(clean.dnd5eSheet,name);
  delete clean.dnd5eSheet;
  const verified=prepareDndDetails(clean,sheet);
  return {details:Object.fromEntries(Object.entries(verified).filter(([key])=>key!=='dnd5eSheet')),sheet};
}
/** Pure parser for later UI enablement. Does not create any character in DB. */
export function parseDndAysV2(source:unknown):{name:string;details:CharacterDetails}{
  if(!source||typeof source!=='object'||Array.isArray(source))throw Error('D&D: неверный экспорт');
  const root=source as Record<string,unknown>;
  if(root.format!=='at-your-service-character'||root.version!==2||root.system!=='DnD')
    throw Error('D&D: неподдерживаемая версия JSON');
  const character=root.character;
  if(!character||typeof character!=='object'||Array.isArray(character))throw Error('D&D: нет персонажа');
  const row=character as Record<string,unknown>;
  if(typeof row.name!=='string'||row.name.length<1||row.name.length>100||row.name!==row.name.trim())
    throw Error('D&D: неверное имя');
  if(!row.details||typeof row.details!=='object'||Array.isArray(row.details))
    throw Error('D&D: неверные дополнительные данные');
  const details={...(row.details as CharacterDetails)};
  // The sheet from the transfer envelope is authoritative, never a stray
  // dnd5eSheet hidden in the loose common details.
  delete details.dnd5eSheet;
  return {name:row.name,details:prepareDndDetails(details,unpackDndSheet(row.sheet))};
}
