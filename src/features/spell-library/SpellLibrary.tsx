import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {
  ArrowLeft,BookOpen,BookMarked,ChevronRight,Filter,RotateCcw,
  Search,ScrollText,Sparkles,X,Layers3
} from 'lucide-react';
import {
  DEFAULT_SPELL_FILTERS,DND_SCHOOLS,PF_TRADITIONS,
  RARITY_LABELS,SPELL_KIND_LABELS,SPELL_SYSTEMS,
  emptySpellCatalog,filterSpellViews,parseSpellCatalog,toSpellViews,
} from './catalog';
import type {
  PfTradition,SpellCatalog,SpellFilters,SpellKind,SpellSystem,SpellView,
} from './catalog';
import './SpellLibrary.css';

type Props={onBack:()=>void};
type Section='all'|SpellKind|'mine';
type Category={id:Section,label:string,description:string};
const COMMON_CATEGORIES:Category[]=[
  {id:'all',label:'Все заклинания',description:'Полный каталог'},
  {id:'cantrip',label:'Чары',description:'Магия без ячеек'},
  {id:'spell',label:'Заклинания',description:'Круги и уровни'},
  {id:'focus',label:'Фокусные',description:'Очки фокуса'},
  {id:'ritual',label:'Ритуалы',description:'Особое сотворение'},
  {id:'special',label:'Особая магия',description:'Классовые системы'},
  {id:'mine',label:'Мои заклинания',description:'В будущем'},
];
const DND_CATEGORIES=COMMON_CATEGORIES.filter(x=>x.id!=='focus'&&x.id!=='special');
const RESULTS_PER_PAGE=50;
function rankLabel(system:SpellSystem,rank:number){
  if(rank===0)return 'Чары';
  return system==='pf2e'?`${rank}-й круг`:`${rank}-й уровень`;
}
function sourceName(spell:SpellView){
  return spell.source?.name||'Источник не указан';
}
function spellKindName(kind:SpellKind):string{
  return SPELL_KIND_LABELS[kind];
}
/** A compact secondary label for list rows and the popup header. */
function spellTypeLabel(spell:SpellView):string{
  const {kind,rank}=spell.spell;
  if(kind==='cantrip')return spell.system==='dnd5e'?'Заговор':'Чары';
  const level=spell.system==='dnd5e'?'уровня':'круга';
  if(kind==='spell')return `Заклинание ${rank}-го ${level}`;
  if(kind==='focus')return `Фокусное заклинание ${rank}-го ${level}`;
  if(kind==='ritual')return `Ритуал ${rank}-го ${level}`;
  return `Особая магия ${rank}-го ${level}`;
}
const PF_TRAIT_LABELS:Record<string,string>={
  cantrip:'Чары',acid:'Кислота',air:'Воздух',attack:'Атака',
  auditory:'Слуховой',cold:'Холод',concentrate:'Концентрация',
  detection:'Обнаружение',earth:'Земля',electricity:'Электричество',
  fire:'Огонь',illusion:'Иллюзия',manipulate:'Манипуляция',
  mental:'Ментальный',metal:'Металл',nonlethal:'Несмертельный',
  plant:'Растение',sanctified:'Освящённый',spirit:'Духовный',
  subtle:'Незаметный',void:'Пустота',water:'Вода',wood:'Дерево',
};
const editionTitle=(edition:string)=>edition==='pf2e-legacy'?'Legacy':edition==='pf2e-remaster'?'Remaster':edition;
function SpellDetails({spell,onClose}: {spell:SpellView;onClose:()=>void}){
  const entry=spell.spell,rules=spell.rules;
  const values=[
    ['Сотворение',rules.cast?.actions===undefined?(rules.cast?.time||'—'):`${rules.cast.actions} действ.`],
    ['Дистанция',rules.range||'—'],
    ['Цели',rules.targets||'—'],
    ['Область',rules.area||'—'],
    ['Защита',rules.savingThrow||'—'],
    ['Длительность',rules.duration||'—'],
    ...(rules.resource==='spell-slot'?[['Расход','Ячейка заклинания']]:[]),
  ].filter(([k,v])=>v!=='—'||k==='Сотворение');
  const name=spell.name===spell.englishName?spell.name:`${spell.name} [${spell.englishName}]`;
  const descriptors=entry.traits.filter(t=>t!=='cantrip').map(t=>PF_TRAIT_LABELS[t]||t);
  return <article className="spell-viewer" aria-label={`Описание заклинания ${spell.name}`}>
    <div className="spell-viewer-top">
      <div className="spell-viewer-heading">
        <span className="spell-eyebrow">{spellTypeLabel(spell)}</span>
        <h2 id="spell-popup-title">{name}</h2>
        <div className="spell-descriptors" aria-label="Дескрипторы">
          {descriptors.map(t=><span key={t}>{t}</span>)}
        </div>
        <div className="spell-edition-line">
          <span>{editionTitle(rules.edition)}</span>
          {rules.edition==='pf2e-legacy'&&<span className="spell-legacy-note">Правила до Remaster</span>}
          {spell.locale==='en'&&<span>Только английский текст</span>}
        </div>
        <p className="spell-source-book"><strong>Источник:</strong> {sourceName(spell)}</p>
      </div>
      <button type="button" className="spell-close" aria-label="Закрыть описание" onClick={onClose}><X size={18}/></button>
    </div>
    <section className="spell-parameters" aria-label="Параметры сотворения">
      {rules.trigger&&<p className="spell-trigger"><b>Триггер:</b> {rules.trigger}</p>}
      {rules.requirements&&<p className="spell-trigger"><b>Требования:</b> {rules.requirements}</p>}
      <dl className="spell-stat-grid">
        {values.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
    <section className="spell-description" aria-label="Описание и эффекты">
      {spell.summary&&<p className="spell-summary">{spell.summary}</p>}
      {spell.description
        ? <p className="spell-body-text">{spell.description}</p>
        : <p className="spell-missing-description">Описание пока не добавлено.</p>}
      {rules.outcomes&&Object.entries(rules.outcomes).length>0&&<div className="spell-outcomes">
        {Object.entries(rules.outcomes).map(([key,value])=><p key={key}><b>{({
          criticalSuccess:'Критический успех',success:'Успех',failure:'Провал',criticalFailure:'Критический провал'
        } as Record<string,string>)[key]||key}:</b> {value}</p>)}
      </div>}
      {rules.heightened&&Object.keys(rules.heightened).length>0&&<section className="spell-heightened">
        <h3>Усиление</h3>
        {Object.entries(rules.heightened).map(([level,description])=><p key={level}><b>{level}:</b> {description}</p>)}
      </section>}
    </section>
    <section className="spell-availability" aria-label="Доступность заклинания">
      <h3>Доступно</h3>
      {entry.system==='pf2e'
        ? <div className="spell-traditions">{entry.traditions.map(t=><span key={t}>{PF_TRADITIONS[t]}</span>)}</div>
        : <div className="spell-traditions">{entry.classes.map(t=><span key={t}>{t}</span>)}</div>}
      {entry.rarity!=='common'&&<p className="spell-rarity">Редкость: {RARITY_LABELS[entry.rarity]}</p>}
    </section>
  </article>;
}

/** A portal prevents the popup from being constrained by the catalogue grid. */
function SpellModal({spell,onClose}:{spell:SpellView;onClose:()=>void}){
  const dialogRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow;
    const focusedBefore=document.activeElement instanceof HTMLElement?document.activeElement:null;
    document.body.style.overflow='hidden';
    const dialog=dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('.spell-close')?.focus({preventScroll:true});
    function onKeyDown(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if(event.key!=='Tab'||!dialog)return;
      const focusable=Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )).filter(node=>node.getClientRects().length>0);
      if(!focusable.length){event.preventDefault();dialog.focus();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    }
    document.addEventListener('keydown',onKeyDown);
    return ()=>{
      document.removeEventListener('keydown',onKeyDown);
      document.body.style.overflow=previousOverflow;
      if(focusedBefore?.isConnected)focusedBefore.focus({preventScroll:true});
    };
  },[onClose]);
  return createPortal(
    <div className="spell-modal-overlay" onMouseDown={event=>{
      if(event.target===event.currentTarget)onClose();
    }}>
      <section ref={dialogRef} className="spell-modal" role="dialog" aria-modal="true"
        aria-labelledby="spell-popup-title" tabIndex={-1}>
        <SpellDetails spell={spell} onClose={onClose}/>
      </section>
    </div>,
    document.body
  );
}

export default function SpellLibrary({onBack}:Props){
  const [system,setSystem]=useState<SpellSystem>('pf2e');
  const [edition,setEdition]=useState<string>(SPELL_SYSTEMS.pf2e.editions[0]);
  const [section,setSection]=useState<Section>('all');
  const [filters,setFilters]=useState<SpellFilters>(DEFAULT_SPELL_FILTERS);
  const [catalog,setCatalog]=useState<SpellCatalog>(()=>emptySpellCatalog('pf2e'));
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const [loadError,setLoadError]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const closeDetails=useCallback(()=>setSelectedId(null),[]);
  const [mobileFilters,setMobileFilters]=useState(false);
  const [visibleCount,setVisibleCount]=useState(RESULTS_PER_PAGE);

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    setLoadState('loading');
    setLoadError('');
    void fetch(`${import.meta.env.BASE_URL}spell-library/${system}.json`,{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        return parseSpellCatalog(await response.json(),system);
      })
      .then(data=>{if(active){setCatalog(data);setLoadState('ready');}})
      .catch(error=>{if(active){
        setLoadError(error instanceof Error?error.message:'Ошибка загрузки каталога');
        setLoadState('error');
      }});
    return ()=>{active=false;controller.abort();};
  },[system]);

  const views=useMemo(()=>toSpellViews(catalog,edition),[catalog,edition]);
  const categories=system==='pf2e'?COMMON_CATEGORIES:DND_CATEGORIES;
  const sectionFilters:SpellFilters={...filters,kind:section==='all'||section==='mine'||(system==='dnd5e'&&section==='ritual')?'all':section};
  const visible=useMemo(()=>{
    if(section==='mine')return [];
    const matches=filterSpellViews(views,sectionFilters);
    // In D&D, Ritual is a casting option on an ordinary spell, not a
    // separate spell kind as in Pathfinder.
    return system==='dnd5e'&&section==='ritual'
      ?matches.filter(entry=>entry.rules.ritual===true||entry.spell.kind==='ritual')
      :matches;
  },[views,system,section,filters]);
  const selected=visible.find(item=>item.id===selectedId);
  const classOptions=useMemo(()=>[...new Set(catalog.spells.flatMap(s=>s.classes))].sort(),[catalog]);
  const sourceOptions=useMemo(()=>catalog.sources.map(s=>s.name).sort(),[catalog]);
  const [sourceFilter,setSourceFilter]=useState('all');
  const shown=sourceFilter==='all'?visible:visible.filter(x=>x.source?.name===sourceFilter);
  const displayed=selected&&shown.find(x=>x.id===selected.id);
  useEffect(()=>setVisibleCount(RESULTS_PER_PAGE),[system,edition,section,filters,sourceFilter]);

  function changeSystem(next:SpellSystem){
    if(next===system)return;
    setSystem(next);setCatalog(emptySpellCatalog(next));setEdition(SPELL_SYSTEMS[next].editions[0]);
    setSection('all');setFilters(DEFAULT_SPELL_FILTERS);setSourceFilter('all');setSelectedId(null);
  }
  const update=<K extends keyof SpellFilters>(key:K,value:SpellFilters[K])=>{
    setFilters(old=>({...old,[key]:value}));setSelectedId(null);
  };
  function reset(){
    setFilters(DEFAULT_SPELL_FILTERS);setSourceFilter('all');setSection('all');
    setSelectedId(null);
  }
  const hasFilters=filters.query!==''||filters.rank!=='all'||filters.tradition!=='all'||
    filters.className!=='all'||filters.school!=='all'||filters.rarity!=='all'||
    filters.locale!=='all'||sourceFilter!=='all'||(section!=='all'&&section!=='mine');

  return <main className="page spell-library-page" id="spell-library" aria-labelledby="spell-library-heading">
    <div className="spell-library-intro">
      <div>
        <button type="button" className="spell-back-link" onClick={onBack}><ArrowLeft size={15}/> К персонажам</button>
        <div className="spell-intro-heading"><BookOpen size={24} strokeWidth={1.55}/><h1 id="spell-library-heading">Библиотека заклинаний</h1></div>
        <p>Справочник магии Pathfinder и D&D: традиции, круги, дескрипторы и правила сотворения.</p>
      </div>
    </div>
    <div className="spell-system-tabs" role="group" aria-label="Игровая система">
      {(Object.keys(SPELL_SYSTEMS) as SpellSystem[]).map(key=><button type="button" key={key}
        aria-pressed={system===key} className={`spell-system-tab${system===key?' is-active':''}`}
        onClick={()=>changeSystem(key)}>
        <span>{SPELL_SYSTEMS[key].label}</span><small>{SPELL_SYSTEMS[key].subtitle}</small>
      </button>)}
    </div>

    <div className="spell-workspace">
      <aside className="spell-sidebar" aria-label="Категории заклинаний">
        <h2>Разделы</h2>
        <nav className="spell-categories" aria-label="Раздел библиотеки">
          {categories.map(item=><button type="button" key={item.id} aria-current={section===item.id?'page':undefined}
            className={`spell-category${section===item.id?' is-active':''}`}
            onClick={()=>{setSection(item.id);setSelectedId(null);}}>
            <span>{item.label}</span><ChevronRight size={15}/>
          </button>)}
        </nav>
        <div className="spell-sidebar-note"><BookMarked size={18}/><p>На листе персонажа можно будет выбирать готовые карточки или оставлять ручное заполнение.</p></div>
      </aside>
      <section className="spell-content" aria-label="Каталог заклинаний">
        <div className="spell-content-heading">
          <div><span className="spell-eyebrow">{SPELL_SYSTEMS[system].label}</span>
            <h2>{categories.find(item=>item.id===section)?.label}</h2></div>
          <span className="spell-total">{loadState==='ready'?shown.length:'—'} записей</span>
        </div>
        <div className="spell-search-row">
          <label className="spell-search"><Search size={19} aria-hidden="true"/>
            <input value={filters.query} onChange={e=>update('query',e.target.value)} type="search"
              placeholder="Поиск по названию, описанию, чертам…" aria-label="Поиск заклинаний"/>
          </label>
          <button type="button" className="spell-filter-toggle" aria-expanded={mobileFilters}
            onClick={()=>setMobileFilters(v=>!v)}><Filter size={17}/> Фильтры</button>
        </div>
        <div className={`spell-filter-panel${mobileFilters?' is-expanded':''}`}>
          <div className="spell-filter-grid">
            <label>Редакция
              <select value={edition} onChange={e=>{setEdition(e.target.value);setSelectedId(null);}}>
                {SPELL_SYSTEMS[system].editions.map(e=><option key={e} value={e}>{e==='pf2e-remaster'?'Remaster':e==='pf2e-legacy'?'Legacy':e==='dnd-2024'?'D&D 2024':'D&D 2014'}</option>)}
              </select>
            </label>
            <label>{system==='pf2e'?'Круг':'Уровень'}
              <select value={filters.rank} onChange={e=>update('rank',e.target.value==='all'?'all':Number(e.target.value))}>
                <option value="all">Все</option>
                {Array.from({length:SPELL_SYSTEMS[system].maxRank+1},(_,i)=><option key={i} value={i}>{rankLabel(system,i)}</option>)}
              </select>
            </label>
            {system==='pf2e'&&<label>Традиция
              <select value={filters.tradition} onChange={e=>update('tradition',e.target.value as PfTradition|'all')}>
                <option value="all">Все традиции</option>
                {Object.entries(PF_TRADITIONS).map(([id,name])=><option key={id} value={id}>{name}</option>)}
              </select>
            </label>}
            {system==='dnd5e'&&<label>Школа магии
              <select value={filters.school} onChange={e=>update('school',e.target.value)}>
                <option value="all">Все школы</option>
                {DND_SCHOOLS.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>}
            <label>Редкость
              <select value={filters.rarity} onChange={e=>update('rarity',e.target.value as SpellFilters['rarity'])}>
                <option value="all">Все</option>
                {Object.entries(RARITY_LABELS).map(([id,name])=><option key={id} value={id}>{name}</option>)}
              </select>
            </label>
            <label>Язык
              <select value={filters.locale} onChange={e=>update('locale',e.target.value as SpellFilters['locale'])}>
                <option value="all">Все языки</option><option value="ru">Есть русский перевод</option>
                <option value="en">Только английский</option>
              </select>
            </label>
            <label>Класс
              <select value={filters.className} onChange={e=>update('className',e.target.value)}>
                <option value="all">Все классы</option>
                {classOptions.map(name=><option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label>Источник
              <select value={sourceFilter} onChange={e=>{setSourceFilter(e.target.value);setSelectedId(null);}}>
                <option value="all">Все книги</option>
                {sourceOptions.map(name=><option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <button className="spell-reset" type="button" onClick={reset}><RotateCcw size={14}/> Сбросить фильтры</button>
        </div>
        {loadState==='loading'&&<div className="spell-loading" role="status">Загружаем каталог…</div>}
        {loadState==='error'&&<div className="spell-empty" role="alert">
          <ScrollText size={29}/><h3>Не удалось открыть каталог</h3><p>{loadError}</p>
          <button type="button" onClick={()=>changeSystem(system==='pf2e'?'dnd5e':'pf2e')}>Открыть другую систему</button>
        </div>}
        {loadState==='ready'&&(shown.length>0
            ? <div className="spell-result-list" role="list">
              {shown.slice(0,visibleCount).map(spell=><button type="button" role="listitem" className="spell-result" key={spell.id} onClick={()=>setSelectedId(spell.id)}>
                <div><strong>{spell.name}</strong><span>{spellTypeLabel(spell)}</span></div>
                <div><ChevronRight size={18}/></div>
              </button>)}
              {shown.length>visibleCount&&<div className="spell-load-more">
                <span>Показано {Math.min(visibleCount,shown.length)} из {shown.length}</span>
                <button type="button" onClick={()=>setVisibleCount(current=>current+RESULTS_PER_PAGE)}>Показать ещё</button>
              </div>}
            </div>
            : <div className="spell-empty" role="status">
                <span className="spell-empty-symbol"><Sparkles size={31} strokeWidth={1.2}/></span>
                <h3>{section==='mine'?'Личные заклинания':hasFilters&&views.length>0?'Ничего не найдено':'Каталог пока пуст'}</h3>
                <p>{section==='mine'
                  ? 'Раздел подготовлен для будущих пользовательских заклинаний. Возможность их создания добавим отдельно.'
                  :hasFilters&&views.length>0
                    ? 'Попробуй изменить поисковый запрос или фильтры.'
                    : 'Раздел пока не наполнен. Следующие партии заклинаний будут появляться постепенно.'}</p>
                {hasFilters&&<button type="button" onClick={reset}>Показать все разделы</button>}
                {!hasFilters&&<div className="spell-empty-footer"><Layers3 size={15}/> Основа для двух игровых систем</div>}
              </div>
        )}
      </section>
    </div>
    {displayed&&<SpellModal spell={displayed} onClose={closeDetails}/>}
  </main>;
}
