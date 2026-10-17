import type {SpellView} from '../spell-library/catalog';

/** Visual layout only: a spell keeps its original PF2e kind and casting resource. */
export const PF_SPELL_LAYOUT='pf_spell_library_layout_v1';
export const SPELL_ZONES=[
  'cantrip','focus','innate','spellbook-left','spellbook-right','rituals-left','rituals-right',
] as const;
export type SpellZone=(typeof SPELL_ZONES)[number];
export type SpellLayoutItem=
  |{kind:'spell';id:string;zone:SpellZone}
  |{kind:'divider';id:string;zone:SpellZone;title:string};
export type SpellLayoutRow=SpellLayoutItem&{spell?:SpellView};

function isZone(value:unknown):value is SpellZone{
  return typeof value==='string'&&(SPELL_ZONES as readonly string[]).includes(value);
}
function cleanTitle(value:unknown):string{
  return typeof value==='string'?value.replace(/[\r\n\t]/g,' ').slice(0,120):'';
}
export function readSpellLayout(raw:unknown):SpellLayoutItem[]{
  if(typeof raw!=='string'||raw.length>128000)return [];
  try{
    const saved:unknown=JSON.parse(raw);
    if(!saved||typeof saved!=='object'||Array.isArray(saved))return [];
    const {version,items}=saved as {version?:unknown;items?:unknown};
    if(version!==1||!Array.isArray(items))return [];
    const seen=new Set<string>();
    const result:SpellLayoutItem[]=[];
    for(const item of items.slice(0,600)){
      if(!item||typeof item!=='object'||Array.isArray(item))continue;
      const row=item as Record<string,unknown>;
      if(typeof row.id!=='string'||row.id.length>130||!row.id||
        seen.has(row.id)||!isZone(row.zone))continue;
      if(row.kind==='spell'&&!row.id.startsWith('divider:')){
        result.push({kind:'spell',id:row.id,zone:row.zone});
      }else if(row.kind==='divider'&&row.id.startsWith('divider:')){
        result.push({kind:'divider',id:row.id,zone:row.zone,title:cleanTitle(row.title)});
      }else continue;
      seen.add(row.id);
    }
    return result;
  }catch{return [];}
}
function encoded(items:SpellLayoutItem[]):string{
  return JSON.stringify({version:1,items});
}
export function automaticSpellZone(spell:SpellView,current:SpellLayoutItem[]):SpellZone{
  if(spell.spell.kind==='cantrip')return 'cantrip';
  if(spell.spell.kind==='focus')return 'focus';
  if(spell.spell.kind==='special')return 'innate';
  const isRitual=spell.spell.kind==='ritual';
  const left=isRitual?'rituals-left':'spellbook-left';
  const right=isRitual?'rituals-right':'spellbook-right';
  return current.filter(row=>row.kind==='spell'&&row.zone===left).length<=
    current.filter(row=>row.kind==='spell'&&row.zone===right).length?left:right;
}
/** Migrate existing characters lazily without rewriting their legacy selection. */
export function resolveSpellLayout(spells:SpellView[],raw:unknown):SpellLayoutRow[]{
  const selected=new Map(spells.map(spell=>[spell.id,spell]));
  const ordered:SpellLayoutRow[]=[];
  for(const row of readSpellLayout(raw)){
    if(row.kind==='divider'){ordered.push(row);continue;}
    const spell=selected.get(row.id);
    if(!spell)continue;
    ordered.push({...row,spell});
    selected.delete(row.id);
  }
  for(const spell of selected.values()){
    const row:SpellLayoutRow={kind:'spell',id:spell.id,zone:automaticSpellZone(spell,ordered),spell};
    ordered.push(row);
  }
  return ordered;
}
function strip(views:SpellLayoutRow[]):SpellLayoutItem[]{
  return views.map(row=>row.kind==='spell'
    ?{kind:'spell',id:row.id,zone:row.zone}
    :{kind:'divider',id:row.id,zone:row.zone,title:row.title});
}
export function moveSpellLayout(
  spells:SpellView[],raw:unknown,id:string,zone:SpellZone,anchorId?:string,after=false,
):string{
  const items=strip(resolveSpellLayout(spells,raw));
  const from=items.findIndex(item=>item.id===id);
  if(from<0)return typeof raw==='string'?raw:'';
  const [entry]=items.splice(from,1);
  const moved:SpellLayoutItem={...entry,zone};
  let position=anchorId?items.findIndex(row=>row.id===anchorId&&row.zone===zone):-1;
  if(position>=0&&after)position++;
  if(position<0)position=items.length;
  items.splice(position,0,moved);
  return encoded(items);
}
export function addSpellDivider(
  spells:SpellView[],raw:unknown,zone:SpellZone,id:string,anchorId?:string,
):string{
  if(!id.startsWith('divider:'))return typeof raw==='string'?raw:'';
  const items=strip(resolveSpellLayout(spells,raw));
  if(items.some(item=>item.id===id))return encoded(items);
  const row:SpellLayoutItem={kind:'divider',id,zone,title:''};
  const index=anchorId?items.findIndex(item=>item.id===anchorId&&item.zone===zone):-1;
  items.splice(index<0?items.length:index+1,0,row);
  return encoded(items);
}
export function setSpellDividerTitle(raw:unknown,id:string,title:string):string{
  const items=readSpellLayout(raw);
  return encoded(items.map(row=>row.kind==='divider'&&row.id===id
    ?{...row,title:cleanTitle(title)}:row));
}
export function deleteSpellDivider(raw:unknown,id:string):string{
  return encoded(readSpellLayout(raw).filter(row=>row.id!==id||row.kind!=='divider'));
}
export function spellZoneRows(rows:SpellLayoutRow[],zone:SpellZone):SpellLayoutRow[]{
  return rows.filter(row=>row.zone===zone);
}
export function spellClassicFieldZone(fieldId:string):SpellZone|null{
  if(fieldId.startsWith('cantrip_'))return 'cantrip';
  if(fieldId.startsWith('focus_'))return 'focus';
  if(fieldId.startsWith('innate_'))return 'innate';
  if(fieldId.startsWith('spellbook_left_'))return 'spellbook-left';
  if(fieldId.startsWith('spellbook_right_'))return 'spellbook-right';
  if(fieldId.startsWith('rituals_left_'))return 'rituals-left';
  if(fieldId.startsWith('rituals_right_'))return 'rituals-right';
  return null;
}
