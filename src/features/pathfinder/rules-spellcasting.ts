/** Pathfinder 2e (Player Core) basic class spellcasting.
 * Once a key attribute is explicitly selected, the printed modifiers are
 * derived from the existing character level and the two existing proficiency
 * marks. No class inference, guessing missing abilities, or situational bonuses.
 * Innate/multiclass sources may use different keys and require later support.
 */
import type {SheetValues} from './sheet-values';
import {isLevel,readNumber,readRank,proficiencyBonus} from './rules-core';

export const SPELLCASTING_ABILITIES=[
  {value:'str',label:'Сила'},
  {value:'dex',label:'Ловкость'},
  {value:'con',label:'Выносливость'},
  {value:'int',label:'Интеллект'},
  {value:'wis',label:'Мудрость'},
  {value:'cha',label:'Харизма'},
] as const;
export type SpellcastingAbility=typeof SPELLCASTING_ABILITIES[number]['value'];

export const SPELL_SLOT_RANKS=10;
const computedNames=new Set(['spell_attack','spell_dc','spell_attack_key','spell_dc_key']);
export function isSpellcastingComputedField(id:string):boolean{return computedNames.has(id);}
export function selectedSpellcastingAbility(values:SheetValues):SpellcastingAbility|null {
  const key=values.spellcasting_key_ability;
  return SPELLCASTING_ABILITIES.find(item=>item.value===key)?.value??null;
}
export function isSpellcastingConfigured(values:SheetValues):boolean {
  return selectedSpellcastingAbility(values)!==null;
}
export type SpellcastingTotals={
  keyAbility:SpellcastingAbility|null;
  abilityModifier:number|undefined;
  level:number|undefined;
  attackProficiency:number|undefined;
  dcProficiency:number|undefined;
  attack:number|undefined;
  dc:number|undefined;
};
export function spellcastingTotals(values:SheetValues):SpellcastingTotals{
  const keyAbility=selectedSpellcastingAbility(values);
  const level=isLevel(values.level);
  const abilityModifier=keyAbility?readNumber(values['ability_'+keyAbility]):undefined;
  const attackRank=readRank(values.spell_attack_rank);
  const dcRank=readRank(values.spell_dc_rank);
  const attackProficiency=level===undefined||attackRank===undefined?undefined:proficiencyBonus(level,attackRank);
  const dcProficiency=level===undefined||dcRank===undefined?undefined:proficiencyBonus(level,dcRank);
  return {
    keyAbility,abilityModifier,level,attackProficiency,dcProficiency,
    attack:keyAbility&&abilityModifier!==undefined&&attackProficiency!==undefined
      ? abilityModifier+attackProficiency:undefined,
    dc:keyAbility&&abilityModifier!==undefined&&dcProficiency!==undefined
      ? 10+abilityModifier+dcProficiency:undefined,
  };
}
export function spellAttackDisplay(value:number):string {
  return value>=0?'+'+value:String(value);
}
export function calculateSpellcasting(values:SheetValues):Record<string,string>{
  const totals=spellcastingTotals(values);
  if(!totals.keyAbility)return {};
  const result:Record<string,string>={};
  if(totals.abilityModifier!==undefined){
    // Component strips show plain numbers, unlike signed final attack values.
    result.spell_attack_key=String(totals.abilityModifier);
    result.spell_dc_key=String(totals.abilityModifier);
  }
  if(totals.attack!==undefined)result.spell_attack=spellAttackDisplay(totals.attack);
  if(totals.dc!==undefined)result.spell_dc=String(totals.dc);
  return result;
}
/** Spell attacks and DC use the same spellcasting proficiency in a normal
 * class source. Only change both ranks when the user explicitly selects
 * proficiency in the settings or edits a marked rank with configured spells.
 */
export function setSpellcastingProficiency(values:SheetValues,rank:number):SheetValues{
  if(!Number.isInteger(rank)||rank<0||rank>4)return values;
  const stored=String(rank);
  return {...values,spell_attack_rank:stored,spell_dc_rank:stored};
}
export function spellSlotCountText(value:unknown):string {
  const raw=String(value??'').trim();
  if(raw==='')return '';
  if(!/^\d{1,3}$/.test(raw))return '';
  const n=Number(raw);
  return Number.isInteger(n)&&n>=0&&n<=999?String(n):'';
}
