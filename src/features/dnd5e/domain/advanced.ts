/** Derived mechanics for the two classic D&D 5e editions.
 * Every operation is pure; user-entered sources never execute script.
 */
import {rollDiceFormula} from '../../../lib/dice-engine.ts';
import {proficiencyBonus,derivedAbility} from './rules.ts';
import {applyDndBonuses} from './bonuses.ts';
import type {Dnd5eSheet,DndBonus,DndResource,DndSpell,DndClassLevel,DndEffect} from './model.ts';

type Random=()=>number;
const MAX_EXPRESSION=280, MAX_EXTRA_ROLLS=200, MAX_TOTAL_DICE=1000;
const integer=(v:number,min:number,max:number)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export function effectiveBonuses(sheet:Dnd5eSheet):DndBonus[]{
  return [...sheet.bonuses,...(sheet.effects??[]).filter(e=>e.active)
    .flatMap(effect=>(effect.bonuses??[]).map(b=>({...b,id:effect.id+':'+b.id,
      source:effect.name+' / '+b.source,active:b.active!==false})))];
}
export function conditionsFor(sheet:Dnd5eSheet):string[]{
  return [...new Set([...sheet.combat.conditions,...(sheet.effects??[])
    .filter(e=>e.active&&e.condition).map(e=>e.condition as string)])];
}
export function tickDndEffects(sheet:Dnd5eSheet):Dnd5eSheet{
  return {...sheet,effects:(sheet.effects??[]).map(e=>
    e.active&&e.rounds!=null?{...e,rounds:Math.max(0,e.rounds-1),
      active:e.rounds>1}:e)};
}
export function resetResources(sheet:Dnd5eSheet,rest:'short'|'long'):Dnd5eSheet{
  return {...sheet,resources:(sheet.resources??[]).map(r=>r.reset==='short'||
    (rest==='long'&&r.reset==='long')?{...r,current:r.maximum}:r),
    spellcasting:{...sheet.spellcasting,slots:{
      normal:rest==='long'?Object.fromEntries(Object.entries(sheet.spellcasting.slots.normal)
        .map(([k,v])=>[k,{...v,used:0}])):sheet.spellcasting.slots.normal,
      pact:Object.fromEntries(Object.entries(sheet.spellcasting.slots.pact)
        .map(([k,v])=>[k,{...v,used:0}]))
    }}};
}
export function spendResource(sheet:Dnd5eSheet,id:string,amount=1):Dnd5eSheet{
  if(!integer(amount,1,99))throw Error('D&D: неверная трата ресурса');
  const items=sheet.resources??[],current=items.find(r=>r.id===id);
  if(!current||current.current<amount)throw Error('D&D: недостаточно ресурса');
  return {...sheet,resources:items.map(r=>r.id===id?{...r,current:r.current-amount}:r)};
}
export function resourceMaximum(resource:DndResource,sheet:Dnd5eSheet):number{
  if(!resource.formula)return resource.maximum;
  const value=evaluateDndExpression(resource.formula,sheet);
  if(!integer(value,0,9999))throw Error('D&D: неверная формула максимума ресурса');
  return value;
}
export type SpellList='known'|'prepared'|'book'|'granted';
export function selectSpells(sheet:Dnd5eSheet,list:SpellList,level?:number):DndSpell[]{
  return sheet.spellcasting.spells.filter(spell=>(level===undefined||spell.level===level)&&(
    list==='known'?spell.known===true:
    list==='prepared'?spell.prepared===true||spell.granted===true:
    list==='book'?spell.inBook===true:spell.granted===true));
}
export function changeSpellFlag(sheet:Dnd5eSheet,id:string,list:SpellList,enabled:boolean):Dnd5eSheet{
  const prop:listFlag='none';
  void prop;
  return {...sheet,spellcasting:{...sheet.spellcasting,spells:sheet.spellcasting.spells.map(s=>{
    if(s.id!==id)return s;
    if(list==='granted')return {...s,granted:enabled};
    if(list==='known')return {...s,known:enabled};
    if(list==='book')return {...s,inBook:enabled};
    return {...s,prepared:enabled};
  })}};
}
type listFlag='none';
export type SpellSlotPool='normal'|'pact';
export function castSpell(sheet:Dnd5eSheet,spellId:string,pool:SpellSlotPool,slotLevel:number):Dnd5eSheet{
  const spell=sheet.spellcasting.spells.find(s=>s.id===spellId);
  if(!spell)throw Error('D&D: заклинание не найдено');
  if(spell.level===0)throw Error('D&D: заговор не требует ячейки');
  if(!spell.prepared&&!spell.granted&&!spell.known)throw Error('D&D: заклинание не подготовлено и не известно');
  if(!integer(slotLevel,1,9)||slotLevel<spell.level)throw Error('D&D: неподходящий круг');
  const slots=sheet.spellcasting.slots[pool];
  const record=slots[String(slotLevel)];
  if(!record||record.used>=record.maximum)throw Error('D&D: ячейки закончились');
  return {...sheet,spellcasting:{...sheet.spellcasting,slots:{
    ...sheet.spellcasting.slots,[pool]:{...slots,
      [slotLevel]:{...record,used:record.used+1}}
  }}};
}
export function restoreSpellSlot(sheet:Dnd5eSheet,pool:SpellSlotPool,level:number):Dnd5eSheet{
  const old=sheet.spellcasting.slots[pool][String(level)];
  if(!old||old.used===0)return sheet;
  return {...sheet,spellcasting:{...sheet.spellcasting,slots:{
    ...sheet.spellcasting.slots,[pool]:{...sheet.spellcasting.slots[pool],
      [level]:{...old,used:old.used-1}}
  }}};
}
/** Multiclass full/half/third caster accounting; pact remains an independent pool.
 * 2014 half/third levels round down. 2024 paladin and ranger round up
 * when multiclassing; "third" (Eldritch Knight/Arcane Trickster) rounds down.
 */
export function effectiveCasterLevel(classes:readonly DndClassLevel[],edition:'2014'|'2024'):number{
  let full=0,half=0,third=0;
  for(const c of classes){
    if(!integer(c.level,1,20))throw Error('D&D: неверный уровень класса');
    if(c.spellcasting==='full')full+=c.level;
    else if(c.spellcasting==='half')half+=edition==='2024'?Math.ceil(c.level/2):Math.floor(c.level/2);
    else if(c.spellcasting==='third')third+=Math.floor(c.level/3);
  }
  return Math.min(20,full+half+third);
}
const SLOT_TABLE:number[][]=[
 [0,0,0,0,0,0,0,0,0],
 [2,0,0,0,0,0,0,0,0],
 [3,0,0,0,0,0,0,0,0],
 [4,2,0,0,0,0,0,0,0],
 [4,3,0,0,0,0,0,0,0],
 [4,3,2,0,0,0,0,0,0],
 [4,3,3,0,0,0,0,0,0],
 [4,3,3,1,0,0,0,0,0],
 [4,3,3,2,0,0,0,0,0],
 [4,3,3,3,1,0,0,0,0],
 [4,3,3,3,2,0,0,0,0],
 [4,3,3,3,2,1,0,0,0],
 [4,3,3,3,2,1,0,0,0],
 [4,3,3,3,2,1,1,0,0],
 [4,3,3,3,2,1,1,0,0],
 [4,3,3,3,2,1,1,1,0],
 [4,3,3,3,2,1,1,1,0],
 [4,3,3,3,2,1,1,1,1],
 [4,3,3,3,3,1,1,1,1],
 [4,3,3,3,3,2,1,1,1],
 [4,3,3,3,3,2,2,1,1],
];
export function multiclassSlots(classes:readonly DndClassLevel[],edition:'2014'|'2024'){
  const casterLevel=effectiveCasterLevel(classes,edition);
  return {casterLevel,slots:Object.fromEntries(SLOT_TABLE[casterLevel].map((amount,i)=>
    [String(i+1),amount])) as Record<string,number>};
}
export function classLevelTotal(classes:readonly DndClassLevel[]):number{
  return classes.reduce((sum,c)=>sum+c.level,0);
}
export function spellAttackBonus(sheet:Dnd5eSheet):number|null{
  const ability=sheet.spellcasting.defaultAbility;
  if(!ability)return null;
  const base=derivedAbility(sheet,ability).value+proficiencyBonus(sheet.identity.level);
  return applyDndBonuses(base,'spell.attack',effectiveBonuses(sheet)).value;
}
/** Variables correspond to actual D&D 5e modifiers; this never invokes eval. */
export function formulaVars(sheet:Dnd5eSheet):Record<string,number>{
  return {
    STR:derivedAbility(sheet,'str').value,DEX:derivedAbility(sheet,'dex').value,
    CON:derivedAbility(sheet,'con').value,INT:derivedAbility(sheet,'int').value,
    WIS:derivedAbility(sheet,'wis').value,CHA:derivedAbility(sheet,'cha').value,
    PROF:proficiencyBonus(sheet.identity.level),LVL:sheet.identity.level,
  };
}
/** Supports a deterministic subset of LSS mathematical syntax: ^, if(...),
 * [STR]/[PROF]/[LVL], arithmetic, floor/ceil/round/abs/min/max. Dice are
 * only evaluated when a secured random source is explicitly supplied.
 * Hard caps prevent excessive work and recursion.
 */
export function evaluateDndExpression(source:string,sheet:Dnd5eSheet,random?:Random):number{
  if(source.length>MAX_EXPRESSION)throw Error('D&D: слишком длинная формула');
  const vars=formulaVars(sheet);
  const withPowers=source.replace(/\^\s*(\d{1,2})/g,(_,exponent:string)=>'**'+exponent);
  // The existing dice engine does not support exponentiation, so expand only
  // small integer exponents through a bounded, arithmetic-only recursion.
  if(withPowers.includes('**')){
    const m=/^\s*(\d+|\[\w+\])\s*\*\*\s*(\d{1,2})\s*$/.exec(withPowers);
    if(!m)throw Error('D&D: степень допустима для одного выражения');
    const base=m[1].startsWith('[')?vars[m[1].slice(1,-1).toUpperCase()]:Number(m[1]);
    if(base===undefined||Number(m[2])>12)throw Error('D&D: степень вне диапазона');
    const result=base**Number(m[2]);
    if(!Number.isFinite(result)||Math.abs(result)>1e10)throw Error('D&D: переполнение степени');
    return result;
  }
  const condition=/^\s*if\(\s*(\[[A-Za-z]+\]|\d+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+)\s*,\s*(.+)\s*,\s*(.+)\s*\)\s*$/s.exec(source);
  if(condition){
    const lhs=condition[1].startsWith('[')?vars[condition[1].slice(1,-1).toUpperCase()]:Number(condition[1]);
    if(lhs===undefined)throw Error('D&D: неизвестная переменная условия');
    const rhs=Number(condition[3]);
    const test=condition[2]==='>='?lhs>=rhs:condition[2]==='<='?lhs<=rhs:
      condition[2]==='=='?lhs===rhs:condition[2]==='!='?lhs!==rhs:condition[2]==='>'?lhs>rhs:lhs<rhs;
    return evaluateDndExpression(test?condition[4]:condition[5],sheet,random);
  }
  const chars=source.replace(/\[(\w+)\]/g,(_,key:string)=>{
    const n=vars[key.toUpperCase()];
    if(n===undefined)throw Error('D&D: неизвестная переменная ['+key+']');
    return String(n);
  });
  if(!random&&/\d*d\d+/i.test(chars))throw Error('D&D: бросок требует источника случайных чисел');
  return rollDiceFormula(chars,{},random??(()=>0)).total;
}
/** LSS-compatible bounded dice features: single-roll reroll-once (ro=1),
 * explosion (!) and 2d20kh1. Complex conditional pools are not guessed.
 * The shared AYS parser remains the source of truth for ordinary dice.
 */
export function rollDndFormula(source:string,sheet:Dnd5eSheet,random:Random){
  if(source.length>MAX_EXPRESSION)throw Error('D&D: слишком длинная формула');
  const expr=source.replace(/[кКD]/g,'d');
  const match=/^(\d{0,2})d(\d{1,5})(ro=(\d+)|!)\s*([+-]\s*[\w\[\]0-9]+)?$/i.exec(expr.trim());
  if(match){
    const n=Number(match[1]||1),sides=Number(match[2]),threshold=Number(match[4]||0);
    if(!integer(n,1,MAX_TOTAL_DICE)||!integer(sides,2,100000)||match[3].startsWith('ro=')&&!integer(threshold,1,sides))
      throw Error('D&D: неверная нотация переброса или взрыва');
    let total=0,rolls=0;
    const faces:number[]=[];
    for(let i=0;i<n;i++){
      let face=takeRandom(random,sides);faces.push(face);rolls++;
      if(match[3].startsWith('ro=')&&face===threshold){face=takeRandom(random,sides);faces.push(face);rolls++;}
      if(match[3]==='!'){
        while(face===sides){
          if(++rolls>MAX_EXTRA_ROLLS)throw Error('D&D: слишком много взрывов кости');
          face=takeRandom(random,sides);faces.push(face);
        }
      }
      total+=face;
    }
    if(match[5])total+=evaluateDndExpression(match[5].replace(/^\+/,'').trim(),sheet)*(match[5].trim().startsWith('-')?-1:1);
    return {total,faces};
  }
  const vars=formulaVars(sheet);
  const result=rollDiceFormula(expr,vars,random);
  return {total:result.total,faces:result.dice.flatMap(d=>d.faces)};
}
function takeRandom(random:Random,sides:number){
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1)throw Error('D&D: небезопасный генератор');
  return Math.floor(value*sides)+1;
}
