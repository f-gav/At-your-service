/** Explicit, reversible advanced D&D mechanics. No schema migrations or hidden
 * class auto-selection: spell prep limits and every slot apply are player choices.
 */
import type {Dnd5eSheet,DndClassLevel,DndEdition,DndResource,DndEffect} from './model.ts';
import {validateDndSheet} from './validation.ts';

export const FULL_CASTER_SLOTS:number[][]=[
 [],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],
 [4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],
 [4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],
 [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],
 [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],
 [4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
export function totalClassLevel(classes:readonly DndClassLevel[]):number{
  const sum=classes.reduce((n,c)=>n+c.level,0);
  if(classes.length>6||!Number.isSafeInteger(sum)||sum<0||sum>20||
    classes.some(c=>!c.id||!c.name.trim()||c.name.length>100||
      !Number.isInteger(c.level)||c.level<1||c.level>20||
      !['none','full','half','third','pact'].includes(c.caster))||
    new Set(classes.map(c=>c.id)).size!==classes.length)
    throw Error('D&D: уровни мультикласса должны суммироваться в пределах 1–20');
  return sum;
}
export function effectiveCasterLevel(classes:readonly DndClassLevel[],edition:DndEdition):number{
  totalClassLevel(classes);
  const multiclass=classes.filter(c=>c.caster!=='none'&&c.caster!=='pact').length>1;
  return Math.min(20,classes.reduce((n,c)=>{
    if(c.caster==='full')return n+c.level;
    if(c.caster==='half')return n+(
      edition==='2024'?Math.ceil(c.level/2):
      multiclass?Math.floor(c.level/2):Math.floor(c.level/2));
    if(c.caster==='third')return n+Math.floor(c.level/3);
    return n;
  },0));
}
export function suggestDndSpellSlots(classes:readonly DndClassLevel[],edition:DndEdition):{
  casterLevel:number;normal:Record<string,{maximum:number;used:number}>;pact:Record<string,{maximum:number;used:number}>;
}{
  totalClassLevel(classes);
  const casterLevel=effectiveCasterLevel(classes,edition);
  const normal:Record<string,{maximum:number;used:number}>={};
  (FULL_CASTER_SLOTS[casterLevel]??[]).forEach((maximum,index)=>{if(maximum>0)normal[String(index+1)]={maximum,used:0};});
  const pact:Record<string,{maximum:number;used:number}>={};
  const warlocks=classes.filter(c=>c.caster==='pact');
  if(warlocks.length>1)throw Error('D&D: нельзя указывать два источника одного договора');
  const lvl=warlocks[0]?.level??0;
  if(lvl>0){
    const level=lvl>=9?5:lvl>=7?4:lvl>=5?3:lvl>=3?2:1;
    const maximum=lvl>=17?4:lvl>=11?3:lvl>=2?2:1;
    pact[String(level)]={maximum,used:0};
  }
  return {casterLevel,normal,pact};
}
export function assignDndClasses(sheet:Dnd5eSheet,classes:readonly DndClassLevel[]):Dnd5eSheet{
  const total=totalClassLevel(classes);
  if(total<1)throw Error('D&D: требуется хотя бы один класс');
  return validateDndSheet({...sheet,identity:{...sheet.identity,level:total,
    className:classes.map(c=>c.name+' '+c.level).join(' / ')},
    progression:{...sheet.progression,classes:[...classes],slotMode:sheet.progression?.slotMode??'manual'}});
}
/** Slot suggestions must never overwrite player counters without an explicit action. */
export function applySuggestedSlots(sheet:Dnd5eSheet):Dnd5eSheet{
  const classes=sheet.progression?.classes??[];
  if(!classes.length)throw Error('D&D: задайте классы перед расчётом ячеек');
  const suggested=suggestDndSpellSlots(classes,sheet.rulesEdition);
  const normal:typeof sheet.spellcasting.slots.normal={};
  const pact:typeof sheet.spellcasting.slots.pact={};
  for(const pool of ['normal','pact'] as const){
    const target=pool==='normal'?normal:pact;
    for(const [level,slot] of Object.entries(suggested[pool])){
      const old=sheet.spellcasting.slots[pool][level];
      target[level]={maximum:slot.maximum,used:Math.min(slot.maximum,old?.used??0)};
    }
  }
  return validateDndSheet({...sheet,spellcasting:{...sheet.spellcasting,slots:{normal,pact}},
    progression:{...sheet.progression,classes:[...classes],slotMode:'suggested'}});
}
export function castDndSpell(sheet:Dnd5eSheet,spellId:string,pool:'normal'|'pact',slotLevel:number):Dnd5eSheet{
  const spell=sheet.spellcasting.spells.find(s=>s.id===spellId);
  if(!spell)throw Error('D&D: заклинание не найдено');
  if(spell.level===0)throw Error('D&D: заговор не тратит ячейки');
  if(spell.slotless)throw Error('D&D: заклинание доступно только без ячеек');
  if(!(spell.prepared||spell.granted||spell.known))throw Error('D&D: заклинание не подготовлено или неизвестно');
  if(!Number.isInteger(slotLevel)||slotLevel<spell.level||slotLevel>9)throw Error('D&D: неверный круг ячейки');
  const available=sheet.spellcasting.slots[pool][String(slotLevel)];
  if(!available||available.used>=available.maximum)throw Error('D&D: нет свободных ячеек этого круга');
  return validateDndSheet({...sheet,spellcasting:{...sheet.spellcasting,
    slots:{...sheet.spellcasting.slots,
      [pool]:{...sheet.spellcasting.slots[pool],
        [slotLevel]:{...available,used:available.used+1}}}}});
}
export function restoreDndRest(sheet:Dnd5eSheet,rest:'short'|'long'):Dnd5eSheet{
  return validateDndSheet({...sheet,
    resources:sheet.resources.map(r=>r.restoreOn==='short'||(rest==='long'&&r.restoreOn==='long')?
      {...r,current:r.maximum}:r),
    spellcasting:{...sheet.spellcasting,
      slots:{normal:rest==='long'
        ?Object.fromEntries(Object.entries(sheet.spellcasting.slots.normal).map(([level,slot])=>[level,{...slot,used:0}]))
        :sheet.spellcasting.slots.normal,
        pact:Object.fromEntries(Object.entries(sheet.spellcasting.slots.pact).map(([level,slot])=>[level,{...slot,used:0}]))}},
  });
}
export function updateDndResource(sheet:Dnd5eSheet,id:string,delta:number):Dnd5eSheet{
  if(!Number.isSafeInteger(delta)||Math.abs(delta)>10000)throw Error('D&D: неверное изменение ресурса');
  if(!sheet.resources.some(r=>r.id===id))throw Error('D&D: ресурс не найден');
  return validateDndSheet({...sheet,
    resources:sheet.resources.map(r=>r.id===id?{...r,current:Math.min(r.maximum,Math.max(0,r.current+delta))}:r),
  });
}
export function advanceDndEffect(sheet:Dnd5eSheet,id:string):Dnd5eSheet{
  if(!sheet.effects.some(e=>e.id===id))throw Error('D&D: эффект не найден');
  return validateDndSheet({...sheet,
    effects:sheet.effects.map(e=>e.id===id&&e.remainingRounds!==undefined?
      {...e,remainingRounds:Math.max(0,e.remainingRounds-1),
        active:e.remainingRounds>1&&e.active}:e),
  });
}
export function dndConditionModifiers(sheet:Dnd5eSheet):{immobile:boolean;attackDisadvantage:boolean;abilityDisadvantage:boolean;incapacitated:boolean}{
  const conditions=new Set(sheet.combat.conditions.map(s=>s.toLowerCase()));
  for(const effect of sheet.effects)
    if(effect.active&&typeof effect.condition==='string')conditions.add(effect.condition.toLowerCase());
  const immobile=['grappled','restrained','paralyzed','petrified','stunned','unconscious','схвачен','опутан','парализован','окаменел','ошеломлён','без сознания'].some(s=>conditions.has(s));
  const incapacitated=['incapacitated','paralyzed','petrified','stunned','unconscious','недееспособен','парализован','окаменел','ошеломлён','без сознания'].some(s=>conditions.has(s));
  const poisoned=conditions.has('poisoned')||conditions.has('отравлен');
  const restrained=conditions.has('restrained')||conditions.has('опутан');
  return {immobile,incapacitated,attackDisadvantage:poisoned||restrained,abilityDisadvantage:poisoned};
}
export function validateDndResource(value:unknown):asserts value is DndResource{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('D&D: неверный ресурс');
  const r=value as DndResource;
  if(typeof r.id!=='string'||!r.id||r.id.length>130||
    typeof r.name!=='string'||!r.name.trim()||r.name.length>120||
    !Number.isSafeInteger(r.maximum)||r.maximum<1||r.maximum>100000||
    !Number.isSafeInteger(r.current)||r.current<0||r.current>r.maximum||
    !['short','long','manual'].includes(r.restoreOn))
    throw Error('D&D: некорректный ресурс');
}
export function validateDndEffect(value:unknown):asserts value is DndEffect{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('D&D: неверный эффект');
  const r=value as DndEffect;
  if(typeof r.id!=='string'||!r.id||r.id.length>130||
    typeof r.name!=='string'||!r.name.trim()||r.name.length>120||
    typeof r.active!=='boolean'||
    (r.remainingRounds!==undefined&&(!Number.isSafeInteger(r.remainingRounds)||r.remainingRounds<0||r.remainingRounds>100000)))
    throw Error('D&D: некорректный эффект');
}
