import {ABILITIES} from './model.ts';
import type {DndEdition,Dnd5eSheet} from './model.ts';

const isObject=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const isInt=(x:unknown,lo:number,hi:number):boolean=>Number.isSafeInteger(x)&&Number(x)>=lo&&Number(x)<=hi;
function requireObject(x:unknown,path:string):asserts x is Record<string,unknown>{
  if(!isObject(x))throw Error('D&D: неверный объект '+path);
}
function walk(x:unknown,depth=0,seen={n:0}):void {
  if(depth>24||++seen.n>2200)throw Error('D&D: превышена сложность данных');
  if(typeof x==='string'&&x.length>22000)throw Error('D&D: текст слишком длинный');
  if(Array.isArray(x)){
    if(x.length>500)throw Error('D&D: массив слишком большой');
    x.forEach(v=>walk(v,depth+1,seen));
  } else if(isObject(x)){
    if(Object.keys(x).length>250)throw Error('D&D: слишком много полей');
    for(const [key,val] of Object.entries(x)){
      if(['__proto__','constructor','prototype'].includes(key))throw Error('D&D: запрещённое имя поля');
      walk(val,depth+1,seen);
    }
  } else if(x!==null && !['string','number','boolean'].includes(typeof x))
    throw Error('D&D: запрещённый тип значения');
  else if(typeof x==='number'&&!Number.isFinite(x))throw Error('D&D: число не конечное');
}
function uniqueRows(value:unknown,name:string,max:number):void{
  if(!Array.isArray(value)||value.length>max)throw Error('D&D: неверный массив '+name);
  const keys=new Set<string>();
  for(const row of value){
    requireObject(row,name);
    if(typeof row.id!=='string'||row.id.length<1||row.id.length>130||keys.has(row.id))
      throw Error('D&D: неверный или повторный id в '+name);
    keys.add(row.id);
  }
}
export function validateDndSheet(input:unknown):Dnd5eSheet{
  walk(input);
  requireObject(input,'sheet');
  if(input.schemaVersion!==1||!['2014','2024'].includes(String(input.rulesEdition))||
    !['2014','2024'].includes(String(input.layoutEdition)))
    throw Error('D&D: версия или редакция не поддерживается');
  for(const key of ['identity','abilities','proficiencies','combat','content','spellcasting','inventory','presentation','imports'])
    requireObject(input[key],key);
  const identity=input.identity as Record<string,unknown>;
  if(typeof identity.name!=='string'||!identity.name.trim()||identity.name.length>100||!isInt(identity.level,1,20))
    throw Error('D&D: неверное имя или уровень');
  const abilities=input.abilities as Record<string,unknown>;
  for(const key of ABILITIES){
    requireObject(abilities[key],key);
    const item=abilities[key] as Record<string,unknown>;
    if(!isInt(item.score,1,30)||(item.manualModifierOverride!==undefined&&item.manualModifierOverride!==null&&!isInt(item.manualModifierOverride,-30,30)))
      throw Error('D&D: неверное значение характеристики '+key);
  }
  const prof=input.proficiencies as Record<string,unknown>;
  for(const key of ['saves','skills']){
    requireObject(prof[key],key);
    if(Object.values(prof[key] as Record<string,unknown>).some(v=>!['none','proficient','expert'].includes(String(v))))
      throw Error('D&D: неверный ранг владения');
  }
  const combat=input.combat as Record<string,unknown>;
  for(const key of ['hp','ac','speed','deathSaves'])requireObject(combat[key],key);
  const hp=combat.hp as Record<string,unknown>, death=combat.deathSaves as Record<string,unknown>;
  if(!isInt(hp.current,0,1000000)||!isInt(hp.maximumBase,1,1000000)||!isInt(hp.temporary,0,1000000)||
    !isInt(combat.exhaustion,0,6)||!isInt(death.successes,0,3)||!isInt(death.failures,0,3)||
    !Array.isArray(combat.conditions)||combat.conditions.some(x=>typeof x!=='string')||
    new Set(combat.conditions).size!==combat.conditions.length)
    throw Error('D&D: неверные боевые показатели');
  uniqueRows(input.attacks,'attacks',100);
  uniqueRows(input.bonuses,'bonuses',300);
  for(const key of ['resources','effects'])if(!Array.isArray(input[key]))throw Error('D&D: неверные '+key);
  const resources=input.resources as unknown[];
  const effects=input.effects as unknown[];
  uniqueRows(resources,'resources',100);
  uniqueRows(effects,'effects',100);
  for(const item of resources){
    requireObject(item,'resource');
    if(typeof item.name!=='string'||!item.name.trim()||item.name.length>120||
      !isInt(item.maximum,1,100000)||!isInt(item.current,0,Number(item.maximum))||
      !['short','long','manual'].includes(String(item.restoreOn)))
      throw Error('D&D: неверный ресурс');
  }
  for(const item of effects){
    requireObject(item,'effect');
    if(typeof item.name!=='string'||!item.name.trim()||item.name.length>120||
      typeof item.active!=='boolean'||
      (item.remainingRounds!==undefined&&!isInt(item.remainingRounds,0,100000))||
      (item.condition!==undefined&&(typeof item.condition!=='string'||item.condition.length>60)))
      throw Error('D&D: неверный эффект');
  }
  for(const bonus of input.bonuses as unknown[]){
    requireObject(bonus,'bonus');
    if(typeof bonus.target!=='string'||bonus.target.length>100||
      typeof bonus.source!=='string'||bonus.source.length>120||
      !['add','base','override','multiply','min','max','advantage','disadvantage'].includes(String(bonus.op))||
      (bonus.value!==undefined&&(typeof bonus.value!=='number'||!Number.isFinite(bonus.value)))||
      (bonus.formula!==undefined&&(typeof bonus.formula!=='string'||bonus.formula.length>1000))||
      (bonus.effectId!==undefined&&(typeof bonus.effectId!=='string'||bonus.effectId.length>130)))
      throw Error('D&D: неверный бонус');
  }
  if(input.progression!==undefined){
    requireObject(input.progression,'progression');
    const classes=input.progression.classes;
    uniqueRows(classes,'classes',6);
    let total=0;
    for(const cls of classes as unknown[]){
      requireObject(cls,'class');
      if(typeof cls.name!=='string'||!cls.name.trim()||cls.name.length>100||
        !isInt(cls.level,1,20)||
        !['full','half','third','none','pact'].includes(String(cls.caster)))
        throw Error('D&D: неверные уровни классов');
      total+=Number(cls.level);
    }
    if(total>20||!['manual','suggested'].includes(String(input.progression.slotMode)))
      throw Error('D&D: неверный мультикласс');
  }
  if(input.features!==undefined){
    uniqueRows(input.features,'features',100);
    for(const feature of input.features as unknown[]){
      requireObject(feature,'feature');
      if(typeof feature.name!=='string'||!feature.name.trim()||feature.name.length>120||
        typeof feature.source!=='string'||feature.source.length>120||
        typeof feature.description!=='string'||typeof feature.active!=='boolean')
        throw Error('D&D: неверная способность');
    }
  }
  const spellcasting=input.spellcasting as Record<string,unknown>;
  uniqueRows(spellcasting.spells,'spells',500);
  for(const spell of spellcasting.spells as unknown[]){
    requireObject(spell,'spell');
    if(typeof spell.name!=='string'||!spell.name.trim()||spell.name.length>160||
      !isInt(spell.level,0,9)||typeof spell.source!=='string'||spell.source.length>120||
      ['prepared','known','inBook','granted','slotless'].some(k=>spell[k]!==undefined&&typeof spell[k]!=='boolean'))
      throw Error('D&D: неверная запись заклинания');
  }
  requireObject(spellcasting.slots,'slots');
  for(const key of ['normal','pact']){
    const slots=(spellcasting.slots as Record<string,unknown>)[key];
    requireObject(slots,'slots.'+key);
    for(const [level,record] of Object.entries(slots)){
      requireObject(record,'slot');
      if(!/^[1-9]$/.test(level)||!isInt(record.maximum,0,99)||!isInt(record.used,0,99)||Number(record.used)>Number(record.maximum))
        throw Error('D&D: неверные ячейки');
    }
  }
  return JSON.parse(JSON.stringify(input)) as Dnd5eSheet;
}
export function changeDndLayout(sheet:Dnd5eSheet,edition:DndEdition):Dnd5eSheet{
  return validateDndSheet({...sheet,layoutEdition:edition});
}
