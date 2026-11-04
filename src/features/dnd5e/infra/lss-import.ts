/** Conservative Long Story Short v2 character importer.
 * The external service's data is a JSON STRING within the v2 envelope.
 * Map only fields with verified semantics; preserve the COMPLETE original
 * payload for a lossless archival export, and never imply that an AYS edit
 * is already synced back to the LSS service.
 */
import {newDndSheet} from '../domain/model.ts';
import type {Dnd5eSheet,DndEdition} from '../domain/model.ts';
import {prepareDndDetails} from './transfer.ts';
import type {CharacterDetails} from '../../../lib/models.ts';
const isRecord=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const safeEdition=(x:unknown):x is DndEdition=>x==='2014'||x==='2024';
const MAX_LSS_LENGTH=1536*1024;
function extractValue(x:unknown):unknown{
  if(isRecord(x)&&'value'in x)return x.value;
  return x;
}
function toString(x:unknown):string|undefined{
  const raw=extractValue(x);
  if(typeof raw==='string')return raw;
  if(isRecord(raw)&&typeof raw.name==='string')return raw.name;
  return undefined;
}
function toNumber(x:unknown,min:number,max:number):number|undefined{
  const value=extractValue(x);
  const n=typeof value==='number'?value:typeof value==='string'&&/^-?\d+$/.test(value.trim())?Number(value):NaN;
  return Number.isSafeInteger(n)&&n>=min&&n<=max?n:undefined;
}
function normalizedName(x:string):string{
  const name=x.trim().slice(0,100);
  if(!name)throw Error('LSS: пустое имя персонажа');
  return name;
}
function h(value:unknown):string{
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
const supported=new Set(['doc','paragraph','text','hardBreak','bulletList','orderedList','listItem','heading',
  'taskList','taskItem','spoiler','spoilerSummary','spoilerContent','divider','roller','formula','resource']);
function richFromProseMirror(node:unknown,notices:Set<string>,depth=0):string {
  if(depth>18)throw Error('LSS: превышена глубина форматированного текста');
  if(!isRecord(node)||typeof node.type!=='string')return '';
  if(!supported.has(node.type))notices.add('Неподдерживаемый узел RichField LSS: '+node.type);
  if(node.type==='text'){
    let text=h(typeof node.text==='string'?node.text:'');
    const marks=Array.isArray(node.marks)?node.marks.slice(0,10):[];
    for(const mark of marks){
      if(!isRecord(mark))continue;
      if(mark.type==='bold')text='<strong>'+text+'</strong>';
      else if(mark.type==='italic')text='<em>'+text+'</em>';
      else if(mark.type==='underline')text='<u>'+text+'</u>';
    }
    return text;
  }
  if(node.type==='hardBreak')return '<br>';
  if(node.type==='divider')return '<div>────────────</div>';
  const children=Array.isArray(node.content)?node.content.slice(0,500):[];
  let inner=children.map(child=>richFromProseMirror(child,notices,depth+1)).join('');
  if(node.type==='roller'||node.type==='formula'||node.type==='resource'){
    const attr=isRecord(node.attrs)?node.attrs:{};
    const formula=typeof attr.formula==='string'?attr.formula:
      typeof attr.expr==='string'?attr.expr:'';
    inner=h('['+node.type+(formula?': '+formula:'')+']')+inner;
  }
  const tag=({paragraph:'p',heading:'p',bulletList:'ul',orderedList:'ol',listItem:'li',
    taskList:'ul',taskItem:'li',spoiler:'div',spoilerSummary:'div',
    spoilerContent:'div',doc:'div'} as Record<string,string>)[node.type];
  return tag?'<'+tag+'>'+inner+'</'+tag+'>':inner;
}
export type ParsedLssCharacter={
  name:string;details:CharacterDetails;warnings:string[];
  edition:DndEdition;sheetEdition:DndEdition;
};
export function parseLssCharacter(input:unknown):ParsedLssCharacter{
  if(!isRecord(input)||input.jsonType!=='character'||input.version!=='2'||
    !safeEdition(input.edition)||!safeEdition(input.sheetEdition)||typeof input.data!=='string')
    throw Error('LSS: ожидается экспорт персонажа версии 2 с отдельными edition, sheetEdition и data-строкой');
  if(input.data.length>MAX_LSS_LENGTH)throw Error('LSS: вложенные данные превышают 1,5 МБ');
  let parsed:unknown;
  try{parsed=JSON.parse(input.data);}catch{throw Error('LSS: поле data содержит некорректную JSON-строку');}
  if(!isRecord(parsed))throw Error('LSS: поле data должно быть объектом');
  const data=parsed;
  const name=normalizedName(toString(data.name)??'Персонаж LSS');
  const sheet:Dnd5eSheet=newDndSheet(name,input.edition);
  sheet.layoutEdition=input.sheetEdition;
  const warnings=new Set<string>();
  const info=isRecord(data.info)?data.info:{};
  const id=sheet.identity;
  const infoFields={className:'charClass',subclass:'charSubclass',species:'race',background:'background',xp:'experience'} as const;
  for(const [field,key] of Object.entries(infoFields)){
    const raw=info[key];
    if(field==='xp')id.xp=toNumber(raw,0,99999999)??0;
    else{
      const value=toString(raw);
      if(value)(id as unknown as Record<string,unknown>)[field]=value.slice(0,120);
    }
  }
  const lvl=toNumber(info.level,1,20);
  if(lvl)id.level=lvl;
  const stats=isRecord(data.stats)?data.stats:{};
  for(const ability of ['str','dex','con','int','wis','cha'] as const){
    const v=stats[ability];
    const score=toNumber(isRecord(v)?v.score:v,1,30);
    if(score!==undefined)sheet.abilities[ability].score=score;
    else if(v!==undefined)warnings.add('Характеристика '+ability+' не перенесена: неподдерживаемая форма');
  }
  const conditions=extractValue(data.conditions);
  if(Array.isArray(conditions))sheet.combat.conditions=[...new Set(conditions.filter((x):x is string=>
    typeof x==='string'&&x.length<=80))].slice(0,20);
  sheet.combat.exhaustion=toNumber(data.exhaustion,0,6)??0;
  const inspiration=extractValue(data.inspiration);
  if(typeof inspiration==='boolean')sheet.combat.inspiration=inspiration;
  const coins=isRecord(data.coins)?data.coins:{};
  for(const key of ['cp','sp','ep','gp','pp'] as const){
    const n=toNumber(coins[key],0,99999999);
    if(n!==undefined)sheet.inventory.coins[key]=n;
  }
  const text=isRecord(data.text)?data.text:{};
  const textKeys:Record<string,string>={
    equipment:'equipment',features:'features',personality:'personality',backstory:'backstory',
    allies:'allies',goals:'goals',treasure:'treasure',bonds:'bonds',
    notes1:'note1',notes2:'note2',notes3:'note3',notes4:'note4',notes5:'note5',notes6:'note6',
  };
  for(const [key,raw] of Object.entries(text)){
    if(!/^[a-zA-Z0-9._-]{1,80}$/.test(key))continue;
    const v=extractValue(raw);
    if(typeof v==='string'){
      sheet.content.blocks[textKeys[key]??'lss-'+key]=v.slice(0,22000);
      continue;
    }
    if(isRecord(v)&&isRecord(v.data)){
      const formatted=richFromProseMirror(v.data,warnings);
      if(formatted)sheet.content.blocks[textKeys[key]??'lss-'+key]='ays:rich:v1:'+formatted;
    }
  }
  const spellSettings=isRecord(input.spells)?input.spells:{};
  sheet.spellcasting.displayMode=spellSettings.mode==='cards'?'cards':'text';
  const known=new Map<string,Dnd5eSheet['spellcasting']['spells'][number]>();
  for(const [group,flag] of [['prepared','prepared'],['book','inBook']] as const){
    const ids=spellSettings[group];
    if(!Array.isArray(ids))continue;
    for(const raw of ids.slice(0,500)){
      if(typeof raw!=='string'||!raw||raw.length>130)continue;
      const item=known.get(raw)??{id:'lss:'+raw,name:raw,level:0,source:'lss-unresolved'};
      (item as unknown as Record<string,unknown>)[flag]=true;
      known.set(raw,item);
    }
  }
  sheet.spellcasting.spells=[...known.values()];
  sheet.imports.unresolvedSpells=[...known.keys()];
  if(known.size)warnings.add('Слаги заклинаний сохранены как ссылки без автоматической подмены текста SRD');
  // The imported original is authoritative for reversible archival export.
  // Never discard unsupported bonuses or resource/formula structures silently.
  const original=JSON.stringify(input);
  sheet.imports.origin='lss-v2';
  sheet.imports.unmapped.lssOriginal=original;
  if(isRecord(data.vitality))warnings.add('Часть показателей vitality требует сверки с реальным LSS-экспортом');
  if(data.bonuses!==undefined)warnings.add('Бонусы LSS сохранены в оригинале; формулы не активированы');
  if(data.resources!==undefined)warnings.add('Ресурсы LSS сохранены в оригинале; нужна сверка схемы');
  if(isRecord(input.disabledBlocks)&&Object.values(input.disabledBlocks)
    .some(value=>Array.isArray(value)&&value.length>0))
    warnings.add('Настройки скрытых блоков LSS сохранены только в архивном оригинале');
  sheet.imports.unmapped.lssWarnings=[...warnings];
  const details=prepareDndDetails({},sheet); // rejects oversized import, never trims.
  return {name,details,warnings:[...warnings],edition:input.edition,sheetEdition:input.sheetEdition};
}
export function exportOriginalLssJson(sheet:Dnd5eSheet):string{
  const source=sheet.imports.unmapped.lssOriginal;
  if(typeof source!=='string')throw Error('LSS: у персонажа нет исходного экспорта LSS');
  // This is deliberately the original file, not a misleading reverse export
  // of edits made in AYS. For edited state, export AYS JSON v2 instead.
  const parsed:unknown=JSON.parse(source);
  if(!isRecord(parsed)||parsed.jsonType!=='character'||parsed.version!=='2')
    throw Error('LSS: исходный файл повреждён');
  return JSON.stringify(parsed,null,2);
}
