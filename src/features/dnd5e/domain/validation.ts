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
  const spellcasting=input.spellcasting as Record<string,unknown>;
  uniqueRows(spellcasting.spells,'spells',500);
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
