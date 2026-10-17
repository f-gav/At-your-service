import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Search} from 'lucide-react';
import {parseSpellCatalog,toSpellViews} from '../spell-library/catalog';
import type {SpellView,SpellCatalog} from '../spell-library/catalog';
import './SpellGrimoire.css';

export type SavedSpell={id:string;prepared:boolean};
export const PF_SPELL_MODE='pf_spell_display_mode';
export const PF_SPELL_SELECTION='pf_spell_library_selection';
export const PF_SPELL_TRADITIONS='pf_spell_available_traditions';
export const PF_SPELL_CLASSES='pf_spell_available_classes';
export const PF_CLASS_LIST=[
 ['bard','Бард','occult'],['cleric','Жрец','divine'],['druid','Друид','primal'],
 ['wizard','Волшебник','arcane'],['magus','Магус','arcane'],['oracle','Оракул','divine'],
 ['psychic','Экстрасенс','occult'],['witch','Ведьма',''],['sorcerer','Чародей',''],
 ['summoner','Призыватель',''],['necromancer','Некромант','occult']
] as const;
export function selectedClasses(raw:unknown):string[]{
 try{const list=JSON.parse(String(raw||'[]'));return Array.isArray(list)?
 list.filter((v):v is string=>typeof v==='string'&&PF_CLASS_LIST.some(([id])=>id===v)):[];}
 catch{return [];}
}

export function readSavedSpells(raw:unknown):SavedSpell[]{
  try{const items=JSON.parse(String(raw||'[]'));return Array.isArray(items)?
    items.filter((v):v is SavedSpell=>!!v&&typeof v.id==='string'&&typeof v.prepared==='boolean')
      .filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i):[];}catch{return [];}
}
export function selectedTraditions(raw:unknown):string[]{
  try{const list=JSON.parse(String(raw||'[]'));return Array.isArray(list)?list.filter(x=>['arcane','divine','occult','primal'].includes(x)):[];}
  catch{return [];}
}
export const PF_TRADITION_IDS=['arcane','divine','occult','primal'] as const;
export function effectivePfTraditions(values:Record<string,string|boolean>):string[]{
  const hasSheetChoices=PF_TRADITION_IDS.some(id=>typeof values['tradition_'+id]==='boolean');
  return hasSheetChoices
    ? PF_TRADITION_IDS.filter(id=>values['tradition_'+id]===true)
    : selectedTraditions(values[PF_SPELL_TRADITIONS]);
}
export function spellCast(spell:SpellView):string{
  const cast=spell.rules.cast;
  if(cast?.actions===1)return '1 д.';
  if(cast?.actions===2)return '2 д.';
  if(cast?.actions===3)return '3 д.';
  if(cast?.time)return cast.time;
  return spell.rules.trigger?'Реакция':'—';
}
export async function loadPfSpellViews(signal:AbortSignal):Promise<SpellView[]>{
  const root=import.meta.env.BASE_URL+'spell-library/';
  const response=await fetch(root+'pf2e.json',{signal});
  if(!response.ok)throw new Error('Не удалось загрузить заклинания');
  const base=parseSpellCatalog(await response.json(),'pf2e') as SpellCatalog;
  // Build lookup indexes once. Translation overlays previously scanned the
  // entire catalogue twice for every entry, delaying first render.
  const normalizeEnglish=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
  const englishByName=new Map<string,(typeof base.translations)[number]>();
  const russianByVersion=new Map<string,number>();
  base.translations.forEach((translation,index)=>{
    if(translation.locale==='en'){
      const key=normalizeEnglish(translation.name);
      if(!englishByName.has(key))englishByName.set(key,translation);
    }
    if(translation.locale==='ru'){
      const key=JSON.stringify([translation.spellId,translation.versionId]);
      if(!russianByVersion.has(key))russianByVersion.set(key,index);
    }
  });
  for(const file of ['pf2e-ays-rank2-cycle1.json','pf2e-ays-rank2-cycle2.json']){
    const overlay=await fetch(root+file,{signal});
    if(!overlay.ok)throw new Error('Не удалось загрузить русские переводы');
    const patch=await overlay.json() as {entries:Array<{englishName:string;name:string;description:string}>};
    for(const entry of patch.entries){
      const english=englishByName.get(normalizeEnglish(entry.englishName));
      if(!english)continue;
      const key=JSON.stringify([english.spellId,english.versionId]);
      const old=russianByVersion.get(key);
      const russian={spellId:english.spellId,versionId:english.versionId,locale:'ru' as const,
        name:entry.name,description:entry.description,translationOrigin:'at-your-service' as const,
        translationStatus:'draft' as const,translatorCredit:'Перевод от At your service!'};
      if(old===undefined){
        russianByVersion.set(key,base.translations.length);
        base.translations.push(russian);
      }else base.translations[old]=russian;
    }
  }
  // The character-sheet grimoire must use the same class-exclusive spell
  // package as the public library. Previously it loaded only pf2e.json, so
  // checking "Некромант" in the sheet could never reveal the grave spells.
  const graveResponse=await fetch(root+'pf2e-necromancer.json',{signal});
  if(!graveResponse.ok)throw new Error('Не удалось загрузить заклинания некроманта');
  const grave=parseSpellCatalog(await graveResponse.json(),'pf2e');
  const spellIds=new Set(base.spells.map(s=>s.id));
  const versionIds=new Set(base.versions.map(v=>v.id));
  const sourceIds=new Set(base.sources.map(s=>s.id));
  if(grave.spells.some(s=>spellIds.has(s.id))||
     grave.versions.some(v=>versionIds.has(v.id))||
     grave.sources.some(s=>sourceIds.has(s.id)))
    throw new Error('Повторяющиеся идентификаторы заклинаний некроманта');
  base.spells.push(...grave.spells);
  base.versions.push(...grave.versions);
  base.translations.push(...grave.translations);
  base.sources.push(...grave.sources);
  return toSpellViews(base,'pf2e-remaster').sort((a,b)=>
    grimoireDisplayRank(a)-grimoireDisplayRank(b)||a.name.localeCompare(b.name,'ru'));
}
/** Even auto-heightened necromancer cantrips with base rank 1 belong in
 * the Cantrips section of the sheet and of the grimoire. */
export function grimoireDisplayRank(spell:SpellView):number{
  return spell.spell.kind==='cantrip'?0:spell.spell.rank;
}
const GROUPS=[['arcane','Мистическая'],['divine','Сакральная'],['occult','Оккультная'],['primal','Первобытная']] as const;
type Props={
  initialSpellId?:string|null;selection:SavedSpell[];traditions:string[];classes:string[];slotCounts:number[];onSelection:(items:SavedSpell[])=>void;onClose:()=>void;
};
export default function SpellGrimoire({initialSpellId,selection,traditions,classes,slotCounts,onSelection,onClose}:Props){
  const [spells,setSpells]=useState<SpellView[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [rank,setRank]=useState<number|'all'>('all');
  const [show,setShow]=useState<'all'|'prepared'>('all');
  const [details,setDetails]=useState<SpellView|null>(null);
  useEffect(()=>{const controller=new AbortController();void loadPfSpellViews(controller.signal)
    .then(items=>{setSpells(items);if(initialSpellId)setDetails(items.find(v=>v.id===initialSpellId)??null);}).catch(e=>{if(!controller.signal.aborted)setError(String(e));})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();},[]);
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){if(details)setDetails(null);else onClose();}};
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[details,onClose]);
  const allowed=useMemo(()=>{
    const effective=new Set([...traditions,...PF_CLASS_LIST.filter(([id])=>classes.includes(id))
      .map(([, ,tradition])=>tradition).filter(Boolean)]);
    return spells.filter(s=>{
      // Class-only magic must never become available merely because the
      // occult tradition is selected or no filters were configured.
      if(s.spell.traditions.length===0&&s.spell.classes.length>0)
        return s.spell.classes.some(c=>classes.includes(c.toLowerCase()));
      return !effective.size||s.spell.traditions.some(t=>effective.has(t))||
        s.spell.classes.some(c=>classes.includes(c.toLowerCase()));
    });
  },[spells,traditions,classes]);
  const results=useMemo(()=>allowed.filter(s=>(rank==='all'||grimoireDisplayRank(s)===rank)&&
    (show==='all'||selection.some(x=>x.id===s.id&&x.prepared))&&
    (!search||[s.name,s.englishName].some(name=>name.toLowerCase().includes(search.toLowerCase())))),[allowed,rank,show,search,selection]);
  const preparedCount=selection.filter(x=>x.prepared&&spells.some(v=>v.id===x.id&&v.spell.rank>0&&v.spell.kind==='spell')).length;
  const availableSlots=slotCounts.reduce((sum,n)=>sum+n,0);
  const update=(spell:SpellView)=>{const old=selection.find(x=>x.id===spell.id);
    onSelection(old?selection.map(x=>x.id===spell.id?{...x,prepared:!x.prepared}:x):[...selection,{id:spell.id,prepared:true}]);};
  const remove=(id:string)=>onSelection(selection.filter(x=>x.id!==id));
  return createPortal(<div className="pf-grimoire-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="pf-grimoire" role="dialog" aria-modal="true" aria-label="Гримуар заклинаний">
      <header><h2>Гримуар</h2><span style={{color:availableSlots>0&&preparedCount>availableSlots?'#b54b4b':undefined}}>Подготовлено: {preparedCount}{availableSlots>0?'/'+availableSlots:''} · Добавлено: {selection.length}</span>
        <button type="button" aria-label="Закрыть гримуар" onClick={onClose}><X size={20}/></button></header>
      <div className="pf-grimoire-tabs">
        <button className={show==='all'?'active':''} onClick={()=>setShow('all')}>Все доступные ({allowed.length})</button>
        <button className={show==='prepared'?'active':''} onClick={()=>setShow('prepared')}>Подготовленные ({selection.filter(x=>x.prepared).length})</button>
      </div>
      <div className="pf-grimoire-filters">
        <label><Search size={16}/><input aria-label="Поиск заклинаний в гримуаре" value={search} placeholder="Поиск названия..." onChange={e=>setSearch(e.target.value)}/></label>
        <select aria-label="Круг заклинаний" value={rank} onChange={e=>setRank(e.target.value==='all'?'all':Number(e.target.value))}>
          <option value="all">Все круги</option>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i===0?'Чары':i+'-й круг'}</option>)}
        </select>
      </div>
      <div className="pf-grimoire-traditions">Выбранные классы: {classes.length?PF_CLASS_LIST.filter(([id])=>classes.includes(id)).map(([,label])=>label).join(', '):'не указаны'} · Доступные традиции: {traditions.length?GROUPS.filter(([id])=>traditions.includes(id)).map(([,label])=>label).join(', '):'все (настройте в параметрах заклинаний)'}</div>
      {loading?<p>Загружаем библиотеку…</p>:error?<p role="alert">{error}</p>:
        <div className="pf-grimoire-scroll">{Array.from({length:11},(_,level)=>{
          const group=results.filter(s=>grimoireDisplayRank(s)===level);
          return group.length?<section key={level}><h3>{level===0?'Чары':'Заклинания '+level+'-го круга'} ({group.length})</h3>
            {group.map(spell=>{const saved=selection.find(x=>x.id===spell.id);return <div className="pf-grimoire-item" key={spell.id}>
              <button type="button" className="pf-grimoire-name" onClick={()=>setDetails(spell)}>{spell.name}</button>
              <small>{spellCast(spell)}</small>
              <button type="button" aria-label={'Подготовить '+spell.name} className={saved?.prepared?'chosen':''} onClick={()=>update(spell)}>{saved?.prepared?'Подготовлено':saved?'Подготовить':'Добавить'}</button>
              {saved&&<button type="button" aria-label={'Удалить '+spell.name} onClick={()=>remove(spell.id)}>×</button>}
            </div>})}</section>:null;
        })}</div>}
    </section>
    {details&&<div className="pf-grimoire-detail" role="dialog" aria-label={'Описание '+details.name}>
      <button type="button" className="pf-grimoire-close" onClick={()=>setDetails(null)} aria-label="Закрыть описание"><X/></button>
      <h2>{details.name}</h2><p>{details.spell.kind==='cantrip'?'Чары':details.spell.kind==='focus'?'Фокусное заклинание '+details.spell.rank+'-го круга':details.spell.rank+'-й круг'} · {spellCast(details)} · {details.rules.range||'—'}</p>
      <div className="pf-grimoire-description">{details.description}</div>
      <button type="button" onClick={()=>{update(details);setDetails(null);}}>{selection.some(x=>x.id===details.id&&x.prepared)?'Снять подготовку':'Подготовить'}</button>
    </div>}
  </div>,document.body);
}
