import {defaultDetails,normalizeDetails,normalizedName} from '../../lib/models';
import type {Character,CharacterDetails,GameSystem} from '../../lib/models';
import {emptyMoonSheet} from '../project-moon/model';

/** Data preparation for character persistence; UI components only manage presentation. */
export function nextCharacterOrder(characters:readonly Character[]):number {
  return characters.reduce((max,character)=>Math.max(max,character.sort_order),0)+1;
}
export function newCharacterDetails(system:GameSystem,pfVariant:'classic'|'alternative'='classic'):CharacterDetails {
  if(system==='prmoon')return {...defaultDetails(),projectMoonSheet:emptyMoonSheet()};
  if(system==='pf2e')return {...defaultDetails(),pathfinderSheet:{pf2e_layout:pfVariant}};
  return defaultDetails();
}
export function copyCharacterDetails(details:CharacterDetails):CharacterDetails {
  // A deep clone is required: two characters must never share editable sheet objects.
  return normalizeDetails(JSON.parse(JSON.stringify(details)) as CharacterDetails);
}
export function characterCopyName(name:string):string {
  return normalizedName(name+' (копия)').slice(0,100);
}
export function confirmedCharacter(row:Character):Character {
  return {...row,details:normalizeDetails(row.details)};
}
