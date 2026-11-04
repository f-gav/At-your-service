import {ABILITIES} from './model.ts';
import type {AbilityId,Dnd5eSheet,Proficiency} from './model.ts';
import {applyDndBonuses,mergeAdvantage} from './bonuses.ts';
export const SKILL_ABILITIES={
  acrobatics:'dex',animalHandling:'wis',arcana:'int',athletics:'str',
  deception:'cha',history:'int',insight:'wis',intimidation:'cha',
  investigation:'int',medicine:'wis',nature:'int',perception:'wis',
  performance:'cha',persuasion:'cha',religion:'int',sleightOfHand:'dex',
  stealth:'dex',survival:'wis',
} as const satisfies Record<string,AbilityId>;
export type SkillId=keyof typeof SKILL_ABILITIES;
export type DndCheck={value:number;advantage:-1|0|1;sources:string[]};
export function abilityModifier(score:number):number{
  if(!Number.isInteger(score)||score<1||score>30)throw Error('D&D: характеристика должна быть от 1 до 30');
  return Math.floor((score-10)/2);
}
export function proficiencyBonus(level:number):number{
  if(!Number.isInteger(level)||level<1||level>20)throw Error('D&D: уровень должен быть от 1 до 20');
  return 2+Math.floor((level-1)/4);
}
export function proficiencyFactor(rank:Proficiency|undefined):number{
  return rank==='expert'?2:rank==='proficient'?1:0;
}
export function exhaustionEffects(sheet:Dnd5eSheet){
  const level=sheet.combat.exhaustion;
  if(sheet.rulesEdition==='2024'){
    return {dead:level>=6,d20Penalty:-2*level,speedPenalty:5*level,
      speedMultiplier:1,hpMultiplier:1,abilityDisadvantage:false,attackDisadvantage:false,saveDisadvantage:false};
  }
  return {dead:level>=6,d20Penalty:0,speedPenalty:0,
    speedMultiplier:level>=5?0:level>=2?0.5:1,hpMultiplier:level>=4?0.5:1,
    abilityDisadvantage:level>=1,attackDisadvantage:level>=3,saveDisadvantage:level>=3};
}
export function derivedAbility(sheet:Dnd5eSheet,ability:AbilityId):DndCheck{
  const item=sheet.abilities[ability];
  const score=applyDndBonuses(item.score,'ability.'+ability,sheet.bonuses).value;
  const calculated=abilityModifier(Math.min(30,Math.max(1,Math.trunc(score))));
  const mod=item.manualModifierOverride??calculated;
  const result=applyDndBonuses(mod,'modifier.'+ability,sheet.bonuses);
  return {value:result.value,advantage:result.advantage,sources:result.trace.map(x=>x.source)};
}
function proficiencyCheck(sheet:Dnd5eSheet,ability:AbilityId,rank:Proficiency|undefined,target:string,kind:'ability'|'save'|'attack'):DndCheck {
  const base=derivedAbility(sheet,ability);
  const proficiency=proficiencyBonus(sheet.identity.level)*proficiencyFactor(rank);
  const result=applyDndBonuses(base.value+proficiency,target,sheet.bonuses);
  const exhaustion=exhaustionEffects(sheet);
  const disadvantage=sheet.rulesEdition==='2014'&&(
    (kind==='ability'&&exhaustion.abilityDisadvantage)||
    (kind==='save'&&exhaustion.saveDisadvantage)||
    (kind==='attack'&&exhaustion.attackDisadvantage));
  return {
    value:result.value+exhaustion.d20Penalty,
    advantage:mergeAdvantage(base.advantage,result.advantage,disadvantage?-1:0),
    sources:[...base.sources,...result.trace.map(x=>x.source),...(exhaustion.d20Penalty?['Истощение 2024']:[])],
  };
}
export function savingThrow(sheet:Dnd5eSheet,ability:AbilityId):DndCheck{
  return proficiencyCheck(sheet,ability,sheet.proficiencies.saves[ability],'save.'+ability,'save');
}
export function skillCheck(sheet:Dnd5eSheet,skill:SkillId):DndCheck {
  return proficiencyCheck(sheet,SKILL_ABILITIES[skill],sheet.proficiencies.skills[skill],'skill.'+skill,'ability');
}
export function attackCheck(sheet:Dnd5eSheet,ability:AbilityId,proficient:boolean):DndCheck {
  return proficiencyCheck(sheet,ability,proficient?'proficient':'none','attack','attack');
}
export function initiative(sheet:Dnd5eSheet):DndCheck{
  const base=derivedAbility(sheet,'dex');
  const r=applyDndBonuses(base.value,'initiative',sheet.bonuses);
  const effects=exhaustionEffects(sheet);
  return {value:r.value+effects.d20Penalty,
    advantage:mergeAdvantage(base.advantage,r.advantage,sheet.rulesEdition==='2014'&&effects.abilityDisadvantage?-1:0),
    sources:[...base.sources,...r.trace.map(x=>x.source)]};
}
/** No eval: package 1 accepts only an integer base, optionally plus DEX. */
export function armorClass(sheet:Dnd5eSheet):number{
  const formula=sheet.combat.ac.baseExpression;
  const match=/^\s*(\d{1,3})(?:\s*\+\s*\[DEX\])?\s*$/i.exec(formula);
  if(!match)throw Error('D&D: базовая формула КЗ пока не поддерживается');
  const base=Number(match[1])+(formula.toUpperCase().includes('[DEX]')?derivedAbility(sheet,'dex').value:0);
  const shield=sheet.combat.ac.shieldEquipped?sheet.combat.ac.shieldBonus:0;
  return applyDndBonuses(base+shield,'ac',sheet.bonuses).value;
}
export function effectiveVitals(sheet:Dnd5eSheet){
  const effects=exhaustionEffects(sheet);
  const maxBase=applyDndBonuses(sheet.combat.hp.maximumBase,'hp.max',sheet.bonuses).value;
  const hpMax=Math.max(1,Math.floor(maxBase*effects.hpMultiplier));
  const walk=Number(sheet.combat.speed.walkBase);
  if(!Number.isFinite(walk)||walk<0||walk>1000)throw Error('D&D: неверная базовая скорость');
  const baseSpeed=applyDndBonuses(walk,'speed.walk',sheet.bonuses).value;
  return {hpMaximum:hpMax,hpCurrent:Math.min(sheet.combat.hp.current,hpMax),
    hpTemporary:sheet.combat.hp.temporary,
    walkSpeed:Math.max(0,baseSpeed*effects.speedMultiplier-effects.speedPenalty),dead:effects.dead};
}
export function derivedDndChecks(sheet:Dnd5eSheet){
  return {abilities:Object.fromEntries(ABILITIES.map(a=>[a,derivedAbility(sheet,a)])),
    saves:Object.fromEntries(ABILITIES.map(a=>[a,savingThrow(sheet,a)])),
    skills:Object.fromEntries(Object.keys(SKILL_ABILITIES).map(s=>[s,skillCheck(sheet,s as SkillId)])),
    initiative:initiative(sheet),armorClass:armorClass(sheet),vitals:effectiveVitals(sheet)};
}
