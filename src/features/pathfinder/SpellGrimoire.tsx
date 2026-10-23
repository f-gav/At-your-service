import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Search} from 'lucide-react';
import {spellSubclassLabel,toSpellViews} from '../spell-library/catalog';
import {loadCachedSpellCatalog} from '../spell-library/cached-catalog';
import {SpellModal} from '../spell-library/SpellLibrary';
import {availableGrimoireClasses,filterGrimoireEntries,groupGrimoireEntries,summarizeGrimoire} from './grimoire-selectors';
import type {SpellView} from '../spell-library/catalog';
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
  const base=await loadCachedSpellCatalog('pf2e',signal,import.meta.env.BASE_URL);
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
  const [classFilter,setClassFilter]=useState<string|'all'>('all');
  const [show,setShow]=useState<'all'|'prepared'>('all');
  const [details,setDetails]=useState<SpellView|null>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const controller=new AbortController();void loadPfSpellViews(controller.signal)
    .then(items=>{setSpells(items);if(initialSpellId)setDetails(items.find(v=>v.id===initialSpellId)??null);}).catch(e=>{if(!controller.signal.aborted)setError(String(e));})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();},[]);
  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    closeRef.current?.focus({preventScroll:true});
    return ()=>{
      document.body.style.overflow=previousOverflow;
      if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    };
  },[]);
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{
      // The spell detail is a second, higher modal: it owns its own focus trap.
      if(details)return;
      if(event.key==='Escape'){
        event.preventDefault();
        onClose();
        return;
      }
      if(event.key!=='Tab'||!dialogRef.current)return;
      const dialog=dialogRef.current;
      const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])'
      )).filter(node=>node.getClientRects().length>0);
      if(!focusable.length){event.preventDefault();dialog.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    };
    document.addEventListener('keydown',onKeyDown);
    return()=>document.removeEventListener('keydown',onKeyDown);
  },[details,onClose]);
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
  const classOptions=useMemo(()=>availableGrimoireClasses(spells,classes),[spells,classes]);
  const activeClassCount=classFilter==='all'?allowed.length:classOptions.find(x=>x.id===classFilter)?.count??0;
  const selectedById=useMemo(()=>new Map(selection.map(entry=>[entry.id,entry] as const)),[selection]);
  const results=useMemo(()=>filterGrimoireEntries(allowed,rank,show,search,selectedById,classFilter),
    [allowed,rank,show,search,selectedById,classFilter]);
  const groups=useMemo(()=>groupGrimoireEntries(results),[results]);
  const knownCount=selection.length;
  const {selectedCount,preparedCount,slotWarnings}=useMemo(
    ()=>summarizeGrimoire(spells,selection,slotCounts),[spells,selection,slotCounts]);
  const add=(spell:SpellView)=>onSelection([...selection,{id:spell.id,prepared:spell.spell.kind!=='spell'}]);
  const togglePrepared=(spell:SpellView)=>onSelection(selection.map(x=>
    x.id===spell.id?{...x,prepared:!x.prepared}:x));
  const remove=(id:string)=>onSelection(selection.filter(x=>x.id!==id));
  return createPortal(<div className="pf-grimoire-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section ref={dialogRef} className="pf-grimoire" role="dialog" aria-modal="true" aria-label="Гримуар заклинаний" tabIndex={-1}>
      <header><h2>Гримуар</h2><span>В ячейках: {preparedCount} · Отмечено: {selectedCount} · Добавлено: {knownCount}</span>
        <button ref={closeRef} type="button" aria-label="Закрыть гримуар" onClick={onClose}><X size={20}/></button></header>
      <div className="pf-grimoire-tabs">
        <button className={show==='all'?'active':''} onClick={()=>setShow('all')}>Все доступные ({activeClassCount})</button>
        <button className={show==='prepared'?'active':''} onClick={()=>setShow('prepared')}>Подготовленные ({selectedCount})</button>
      </div>
      <div className="pf-grimoire-filters">
        <label><Search size={16}/><input aria-label="Поиск заклинаний в гримуаре" value={search} placeholder="Поиск названия..." onChange={e=>setSearch(e.target.value)}/></label>
        <select aria-label="Круг заклинаний" value={rank} onChange={e=>setRank(e.target.value==='all'?'all':Number(e.target.value))}>
          <option value="all">Все круги</option>{Array.from({length:11},(_,i)=><option key={i} value={i}>{i===0?'Чары':i+'-й круг'}</option>)}
        </select>
      </div>
      {classOptions.length>0&&<div className="pf-grimoire-class-filters" role="group" aria-label="Классовые заклинания">
        <button type="button" className={classFilter==='all'?'active':''} aria-pressed={classFilter==='all'}
          onClick={()=>setClassFilter('all')}>Все классы</button>
        {classOptions.map(({id,count})=><button type="button" key={id}
          className={classFilter===id?'active':''} aria-pressed={classFilter===id}
          onClick={()=>setClassFilter(current=>current===id?'all':id)}>
          {PF_CLASS_LIST.find(([key])=>key===id)?.[1]??id} ({count})
        </button>)}
      </div>}
      <div className="pf-grimoire-traditions">Выбранные классы: {classes.length?PF_CLASS_LIST.filter(([id])=>classes.includes(id)).map(([,label])=>label).join(', '):'не указаны'} · Доступные традиции: {traditions.length?GROUPS.filter(([id])=>traditions.includes(id)).map(([,label])=>label).join(', '):'все (настройте в параметрах заклинаний)'}</div>
      {slotWarnings.length>0&&<p className="pf-grimoire-slot-warning" role="status">Проверьте ячейки по кругам: {slotWarnings.join('; ')}. Это подсказка, а не ограничение подготовки.</p>}
      {loading?<p>Загружаем библиотеку…</p>:error?<p role="alert">{error}</p>:
        <div className="pf-grimoire-scroll">{Array.from({length:11},(_,level)=>{
          const group=groups[level];
          return group.length?<section key={level}><h3>{level===0?'Чары':'Заклинания '+level+'-го круга'} ({group.length})</h3>
            {group.map(spell=>{const saved=selectedById.get(spell.id);return <div className="pf-grimoire-item" key={spell.id}>
              <button type="button" className="pf-grimoire-name" onClick={()=>setDetails(spell)}>{spell.name}{spell.spell.kind==='focus'&&<span className="pf-grimoire-focus-tag">Фокусное</span>}{spellSubclassLabel(spell.spell)&&<span className="pf-grimoire-subclass-tag">Подкласс: {spellSubclassLabel(spell.spell)}</span>}</button>
              <small>{spellCast(spell)}</small>
              {!saved?<button type="button" aria-label={'Добавить '+spell.name} onClick={()=>add(spell)}>Добавить</button>:
                spell.spell.kind==='spell'?<button type="button" aria-label={(saved.prepared?'Снять подготовку ':'Подготовить ')+spell.name}
                  className={saved.prepared?'chosen':''} onClick={()=>togglePrepared(spell)}>
                  {saved.prepared?'Подготовлено':'Подготовить'}
                </button>:<span className="pf-grimoire-no-slot" title="Без подготовки через ячейки">Добавлено</span>}
              {saved&&<button type="button" aria-label={'Удалить '+spell.name} onClick={()=>remove(spell.id)}>×</button>}
            </div>})}</section>:null;
        })}</div>}
    </section>
    {details&&<SpellModal spell={details} onClose={()=>setDetails(null)} layer="grimoire"/>}
  </div>,document.body);
}
