import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {
  ArrowLeft,BookOpen,ChevronRight,ChevronDown,Clock3,Ruler,Shield,Filter,RotateCcw,
  Search,ScrollText,Sparkles,X,Layers3
} from 'lucide-react';
import {
  DEFAULT_SPELL_FILTERS,DND_SCHOOLS,PF_TRADITIONS,
  RARITY_LABELS,SPELL_SYSTEMS,
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
function sourceName(spell:SpellView){
  return spell.source?.name||'Источник не указан';
}
/** Abbreviation is visual only: full book source remains in title and popup. */
function sourceAbbreviation(spell:SpellView){
  const title=spell.source?.name;
  if(!title)return '—';
  const words=title.replace(/^Pathfinder\s+/i,'').split(/\s+/).filter(w=>!/^(of|the|and|для|и)$/i.test(w));
  return words.map(w=>w[0]?.toUpperCase()||'').join('').slice(0,4)||'—';
}
/** Localize PF2e rules metadata, without changing mechanical quantities. */
function localizeRuleValue(value:string,field:'time|'range'|'targets'|'area'|'savingThrow'|'duration'):string{
  const source=value.trim();
  if(!source||source==='—')return source;
  // Imports of rank-two spells can contain a raw Foundry {type,value} object.
  // This defensive renderer also protects old cached catalogs.
  if(field==='area'){
    let kind='',size=0;
    if(source.startsWith('{')){
      try {
        const parsed:unknown=JSON.parse(source);
        if(parsed&&typeof parsed==='object'&&'type' in parsed&&'value' in parsed){
          const a=parsed as {type:unknown,value:unknown};
          kind=String(a.type); size=Number(a.value);
        }
      } catch {/* invalid source data is left unaltered */}
    }
    const match=source.match(/^(burst|cone|emanation|line|cube|square):\s*(\d+)\s+feet$/i);
    if(match){kind=match[1];size=Number(match[2]);}
    if(Number.isFinite(size)&&size>0){
      const prefix:Record<string,string>={burst:'взрыв',cone:'конус',emanation:'эманация',line:'линия',cube:'куб',square:'квадрат'};
      if(prefix[kind])return size+'-футов'+(kind==='emanation'||kind==='line'?'ая':'ый')+' '+prefix[kind];
    }
  }
  if(field==='savingThrow'){
    const match=source.match(/^(?:(basic|обычный|простой)\s+)?(?:(?:спасбросок|save)\s+)?(reflex|fortitude|will|рефлекс(?:а)?|стойкост(?:ь|и)|вол(?:я|и))(?:\s+save)?$/i);
    if(match){
      const key=match[2].toLowerCase();
      const name=key.startsWith('reflex')||key.startsWith('рефлекс')?'Рефлекса':
        key.startsWith('fortitude')||key.startsWith('стойкост')?'Стойкости':'Воли';
      return (match[1]?'Обычный ':'')+'спасбросок '+name;
    }
  }
  const exact:Record<string,string>={
    '1 object':'1 предмет','1 creature':'1 существо','1 or 2 creatures':'1 или 2 существа',
    '1 creature or object':'1 существо или предмет','1 willing creature':'1 согласное существо',
    '1 enemy':'1 враг','1 ally and 1 enemy':'1 союзник и 1 враг',
    '1 dying creature':'1 умирающее существо','1 non-hostile domesticated animal':'1 неагрессивное домашнее животное',
    '1 living creature':'1 живое существо','1 creature that is undead or otherwise has void healing':'1 нежить или существо с исцелением пустотой',
    'a handful of dirt or mud':'горсть земли или грязи',
    '1 creature whose true name you know':'1 существо, истинное имя которого вам известно',
    '2 willing creatures':'2 согласных существа',
    '1 object (cook, lift, or tidy only)':'1 предмет (только готовить, поднимать или прибирать)',
    'your eidolon, or a creature with the minion trait under your control':'ваш эйдолон или подконтрольное существо с признаком «миньон»',
    '1 unattended object of light Bulk or less':'1 бесхозный предмет массой не более 1 лёгкой единицы',
    '2 creatures that each have an unfriendly or worse attitude toward the other':'2 существа, недружелюбно или хуже относящиеся друг к другу',
    'one object (see below)':'1 предмет (см. описание)',
    '1 metal weapon that is unattended or is wielded by you or a willing ally':'1 бесхозное металлическое оружие либо оружие в руках вас или согласного союзника',
    '1 held object of 2 Bulk or less':'1 удерживаемый предмет массой не более 2 единиц',
    '1 Large or smaller corpse':'1 труп размера Большой или меньше',
    '1 object or creature':'1 предмет или существо',
    'one door or similar opening':'1 дверь или аналогичный проём',
    '1 item or spell effect':'1 предмет или эффект заклинания',
    'varies':'различается','reaction':'Реакция','touch':'Касание',
    'unlimited':'неограниченная','see text':'см. описание','see description':'см. описание',
    'planetary':'планетарная','up to 8 hours':'до 8 часов','1 year':'1 год',
    '1 minute (see text)':'1 минута (см. описание)',
    '10 minutes or 8 hours':'10 минут или 8 часов',
    '1 minute or 8 hours':'1 минута или 8 часов',
    'until the next time you make your daily preparations':'до следующей ежедневной подготовки',
    'until the next time you make your daily preparations or until discharged':'до следующей ежедневной подготовки или до разрядки',
    'until your next daily preparations':'до следующей ежедневной подготовки',
    "until the end of the target's next turn":'до конца следующего хода цели',
    '1 cubic foot':'1 кубический фут',
    '1 to 3':'1–3 действия',
    '1 or more rounds (see below)':'1 или более раундов (см. описание)',
    '1 unattended metallic object up to 5 Bulk':'1 бесхозный металлический предмет массой до 5 единиц',
  };
  if(exact[source])return exact[source];
  const timeMatch=source.match(/^(\d+)\s+(minute|minutes|hour|hours|round|rounds|day|days)$/i);
  if(timeMatch){
    const n=Number(timeMatch[1]);
    const unit=timeMatch[2].toLowerCase();
    const plural=(one:string,few:string,many:string)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;
    if(unit.startsWith('minute'))return n+' '+plural('минута','минуты','минут');
    if(unit.startsWith('hour'))return n+' '+plural('час','часа','часов');
    if(unit.startsWith('round'))return n+' '+plural('раунд','раунда','раундов');
    return n+' '+plural('день','дня','дней');
  }
  const feet=source.match(/^(\d+)\s+(feet|foot|miles?|meters?)$/i);
  if(feet)return feet[1]+' '+(feet[2].startsWith('mile')?'миль':feet[2].startsWith('meter')?'метров':'футов');
  const area=source.match(/^(cone|burst|emanation|line|cube|square):\s*(\d+)\s+feet$/i);
  if(area){
    const noun:{[key:string]:string}={cone:'Конус',burst:'Взрыв',emanation:'Эманация',line:'Линия',cube:'Куб',square:'Квадрат'};
    return noun[area[1].toLowerCase()]+' '+area[2]+' футов';
  }
  const save=source.match(/^(basic\s+)?(reflex|fortitude|will)\s+save$/i);
  if(save){
    const names:{[key:string]:string}={reflex:'Рефлекса',fortitude:'Стойкости',will:'Воли'};
    return (save[1]?'Простой спасбросок ':'Спасбросок ')+names[save[2].toLowerCase()];
  }
  return source;
}

function cardCasting(spell:SpellView){
  const cast=spell.rules.cast;
  if(typeof cast?.actions==='number')return {short:cast.actions+' д.',long:'Сотворение: '+cast.actions+' действий'};
  const time=localizeRuleValue(cast?.time||'—','time');
  return {short:time==='Реакция'?'Р':time,long:'Сотворение: '+time};
}
function cardDefense(spell:SpellView){
  const save=localizeRuleValue(spell.rules.savingThrow||'','savingThrow');
  const short=save.includes('Рефлекс')?'Рефлекс':save.includes('Стойкость')?'Стойкость':
    save.includes('Воли')?'Воля':save.includes('КБ')?'КБ':save||'—';
  return {short,long:'Защита: '+(save||'не указана')};
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
  aura:'Аура',emotion:'Эмоция',linguistic:'Языковой',sonic:'Звук',
  morph:'Изменение формы',healing:'Исцеление',fortune:'Удача',
  'true-name':'Истинное имя',light:'Свет',poison:'Яд',force:'Сила',
  vitality:'Жизненная энергия',good:'Добро',incapacitation:'Недееспособность',
  curse:'Проклятие',visual:'Визуальный',fear:'Страх',darkness:'Тьма',
  shadow:'Тень',disease:'Болезнь',misfortune:'Неудача',move:'Движение',
  polymorph:'Полиморф',extradimensional:'Внепространственный',
  summon:'Призыв',mythic:'Мифический',sleep:'Сон',
  teleportation:'Телепортация',olfactory:'Обонятельный',
  prediction:'Предсказание',holy:'Святой',death:'Смерть',fungus:'Гриб',
  evil:'Зло',unholy:'Нечестивый',contingency:'Условный',revelation:'Откровение',scrying:'Наблюдение',
};
const editionTitle=(edition:string)=>edition==='pf2e-legacy'?'Legacy':edition==='pf2e-remaster'?'Remaster':edition;
function SpellDetails({spell,onClose}: {spell:SpellView;onClose:()=>void}){
  const entry=spell.spell,rules=spell.rules;
  const values=[
    ['Сотворение',rules.cast?.actions===undefined?(localizeRuleValue(rules.cast?.time||'—','time')):`${rules.cast.actions} действ.`],
    ['Дистанция',localizeRuleValue(rules.range||'—','range')],
    ['Цели',localizeRuleValue(rules.targets||'—','targets')],
    ['Область',localizeRuleValue(rules.area||'—','area')],
    ['Защита',localizeRuleValue(rules.savingThrow||'—','savingThrow')],
    ['Длительность',localizeRuleValue(rules.duration||'—','duration')],
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
          {spell.translationOrigin==='at-your-service'&&<span className="spell-translation-origin">Перевод от At your service!</span>}
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
        <h3>{spell.translationOrigin==='at-your-service'?'Повышенное':'Усиление'}</h3>
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
  function chooseRank(rank:number|'all'){
    setFilters(old=>({...old,rank}));
    // Cantrips are stored at rank 0, while ordinary spells start at rank 1.
    if((rank===0&&section==='spell')||(rank!==0&&rank!=='all'&&section==='cantrip'))
      setSection('all');
    setSelectedId(null);
  }
  function chooseCategory(kind:Section){
    setSection(kind);
    if((kind==='cantrip'&&filters.rank!=='all'&&filters.rank!==0)||
       (kind==='spell'&&filters.rank===0))
      setFilters(old=>({...old,rank:'all'}));
    setSelectedId(null);
  }
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
        <button type="button" className="spell-back-link" onClick={onBack}><ArrowLeft size={16}/> К персонажам</button>
        <div className="spell-intro-heading"><BookOpen size={27} strokeWidth={1.55}/><h1 id="spell-library-heading">Библиотека заклинаний</h1></div>
        <p>Pathfinder 2e и D&D 5e — быстрый поиск магии, правила сотворения и источники.</p>
      </div>
      <div className="spell-library-count" aria-label="Статистика каталога">
        <strong>{loadState==='ready'?views.length:'—'}</strong><span>в каталоге</span>
      </div>
    </div>
    <div className="spell-system-tabs" role="group" aria-label="Игровая система">
      {(Object.keys(SPELL_SYSTEMS) as SpellSystem[]).map(key=><button type="button" key={key}
        aria-pressed={system===key} className={`spell-system-tab${system===key?' is-active':''}`}
        onClick={()=>changeSystem(key)}>
        <span>{SPELL_SYSTEMS[key].label}</span><small>{SPELL_SYSTEMS[key].subtitle}</small>
      </button>)}
    </div>

    <section className="spell-content" aria-label="Каталог заклинаний">
      <div className="spell-content-heading">
        <div><span className="spell-eyebrow">{SPELL_SYSTEMS[system].label}</span>
          <h2>{categories.find(item=>item.id===section)?.label}</h2></div>
        <span className="spell-total">{loadState==='ready'?shown.length:'—'} записей</span>
      </div>
      <div className="spell-search-row">
        <label className="spell-search"><Search size={20} aria-hidden="true"/>
          <input value={filters.query} onChange={e=>update('query',e.target.value)} type="search"
            placeholder="Поиск по названию, описанию, чертам…" aria-label="Поиск заклинаний"/>
        </label>
        <button type="button" className={`spell-filter-toggle${mobileFilters?' is-active':''}`}
          aria-controls="spell-expanded-filters" aria-expanded={mobileFilters}
          onClick={()=>setMobileFilters(v=>!v)}><Filter size={18}/> Фильтры <ChevronDown size={16}/></button>
        <button type="button" className="spell-reset-main" onClick={reset} disabled={!hasFilters}
          title="Сбросить поиск, категории и фильтры"><RotateCcw size={16}/> <span>Сбросить</span></button>
      </div>

      <div className="spell-quick-controls">
        <div className="spell-quick-group" aria-label={system==='pf2e'?'Быстрый выбор круга':'Быстрый выбор уровня'}>
          <span className="spell-quick-label">{system==='pf2e'?'Круг':'Уровень'}</span>
          <div className="spell-chips-scroll">
            <button type="button" className={`spell-rank-chip${filters.rank==='all'?' is-active':''}`}
              aria-pressed={filters.rank==='all'} onClick={()=>chooseRank('all')}>Все</button>
            {Array.from({length:SPELL_SYSTEMS[system].maxRank+1},(_,rank)=><button
              type="button" key={rank} className={`spell-rank-chip${filters.rank===rank?' is-active':''}`}
              title={rank===0?(system==='pf2e'?'Чары':'Заговоры'):`${rank}-й ${system==='pf2e'?'круг':'уровень'}`}
              aria-pressed={filters.rank===rank} onClick={()=>chooseRank(rank)}>{rank}</button>)}
          </div>
        </div>
        <nav className="spell-quick-group spell-kind-group" aria-label="Тип заклинаний">
          <span className="spell-quick-label">Тип</span>
          <div className="spell-chips-scroll">
            {categories.map(item=><button type="button" key={item.id}
              aria-pressed={section===item.id}
              className={`spell-kind-chip${section===item.id?' is-active':''}`}
              onClick={()=>chooseCategory(item.id)}>{item.label}</button>)}
          </div>
        </nav>
      </div>

      <div id="spell-expanded-filters" className={`spell-filter-panel${mobileFilters?' is-expanded':''}`}>
        <div className="spell-filter-grid">
          <label>Редакция
            <select value={edition} onChange={e=>{setEdition(e.target.value);setSelectedId(null);}}>
              {SPELL_SYSTEMS[system].editions.map(e=><option key={e} value={e}>{e==='pf2e-remaster'?'Remaster':e==='pf2e-legacy'?'Legacy':e==='dnd-2024'?'D&D 2024':'D&D 2014'}</option>)}
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
      </div>

      {loadState==='loading'&&<div className="spell-loading" role="status">Загружаем каталог…</div>}
      {loadState==='error'&&<div className="spell-empty" role="alert">
        <ScrollText size={29}/><h3>Не удалось открыть каталог</h3><p>{loadError}</p>
        <button type="button" onClick={()=>changeSystem(system==='pf2e'?'dnd5e':'pf2e')}>Открыть другую систему</button>
      </div>}
      {loadState==='ready'&&(shown.length>0
        ? <div className="spell-result-list" role="list">
          {shown.slice(0,visibleCount).map(spell=>{
            const casting=cardCasting(spell);
            const defense=cardDefense(spell);
            const range=localizeRuleValue(spell.rules.range||'—','range');
            return <button type="button" role="listitem" className="spell-result" key={spell.id}
              onClick={()=>setSelectedId(spell.id)} aria-label={`${spell.name}, ${spellTypeLabel(spell)}`}>
              <div className="spell-result-heading">
                <div className="spell-result-identity"><strong>{spell.name}</strong><span>{spellTypeLabel(spell)}</span></div>
                <span className="spell-source-label" title={sourceName(spell)} aria-label={`Книга: ${sourceName(spell)}`}>
                  {sourceAbbreviation(spell)}</span>
              </div>
              <div className="spell-result-stats">
                <span className="spell-mini-stat" title={casting.long}><Clock3 size={14} aria-hidden="true"/>{casting.short}</span>
                <span className="spell-mini-stat" title={`Дистанция: ${range}`}><Ruler size={14} aria-hidden="true"/>{range}</span>
                <span className="spell-mini-stat" title={defense.long}><Shield size={14} aria-hidden="true"/>{defense.short}</span>
              </div>
              <ChevronRight className="spell-open-icon" size={17} aria-hidden="true"/>
            </button>;
          })}
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
    {displayed&&<SpellModal spell={displayed} onClose={closeDetails}/>}
  </main>;
}
