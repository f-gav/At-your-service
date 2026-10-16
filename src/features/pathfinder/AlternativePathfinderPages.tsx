import {useMemo} from 'react';
import type {ReactNode} from 'react';
import {BookOpen, Settings2, Shield, Heart, Swords, ScrollText, Coins, Eye, Feather, Sparkles, Backpack, WandSparkles, UserRound, Gem, Compass, BookMarked, Scroll, Star, CircleDot, Zap, Skull, Crown} from 'lucide-react';
import RichField from './RichField';
import {RANK_FIELDS, RANK_LABELS,SKILL_ABILITIES,readRank,isAutomatic,isCoreComputedField} from './rules-core';
import {isSpellcastingComputedField,isSpellcastingConfigured,spellcastingTotals} from './rules-spellcasting';
import {isNativeCombatComputedField,isNativeWeaponAttackField,isClassDcConfigured} from './rules-combat';
import {PF_NOTES_BLOCK_COUNT,noteBodyKey,noteTitleKey,noteBlockTitle} from './notes-blocks';
import {DYING_SKULL_COUNT,readDyingSkulls,toggleDyingSkull} from './dying-skulls';
import type {SheetValues,FieldValue} from './sheet-values';
import type {EditableField} from './editor-schema';
import type {SpellView} from '../spell-library/catalog';
import {spellCast,effectivePfTraditions} from './SpellGrimoire';
import DynamicAdvancement from './DynamicAdvancement';
import {ADVANCEMENT_FIELD_IDS,advancementLevelCount} from './advancement-model';
import './AlternativePathfinderPages.css';
import './AlternativePathfinderFirstPage.css';
import './AlternativePathfinderDefenses.css';
import './AlternativePathfinderSkills.css';
import './AlternativePathfinderTypography.css';
import './AlternativePathfinderRightColumn.css';
import './AlternativePathfinderAdvancement.css';
import './AlternativePathfinderEquipment.css';
import './AlternativePathfinderBiography.css';
import './AlternativePathfinderActions.css';
import './AlternativePathfinderMagic.css';

type Props={
  page:number|'notes';fields:EditableField[];values:SheetValues;displayValues:SheetValues;
  legacyHasValues:boolean;preparedSpells:SpellView[];spellMode:'library'|'text';
  onChange:(id:string,value:FieldValue)=>void;onOpenGrimoire:()=>void;
  onOpenSettings:()=>void;
  portraitUrl?:string;onEditPortrait:()=>void;
  onAddLevel:()=>void;onRemoveLevel:(level:number)=>void;disabled?:boolean;
};
const ABILITIES=[['str','Сила'],['dex','Ловкость'],['con','Выносливость'],['int','Интеллект'],['wis','Мудрость'],['cha','Харизма']] as const;
const SAVE_NAMES=[['fort','Стойкость'],['reflex','Рефлексы'],['will','Воля']] as const;
const SKILLS=[
 ['acrobatics','Акробатика'],['athletics','Атлетика'],['thievery','Воровство'],
 ['survival','Выживание'],['diplomacy','Дипломатия'],['intimidation','Запугивание'],
 ['lore1','Знание I'],['lore2','Знание II'],['performance','Исполнение'],
 ['medicine','Медицина'],['arcana','Мистицизм'],['deception','Обман'],
 ['society','Общество'],['occultism','Оккультизм'],['nature','Природа'],
 ['religion','Религия'],['crafting','Ремесло'],['stealth','Скрытность']
] as const;
const PAGE_CAPTIONS:Record<string,string>={
 '1':'Характеристики и бой','2':'Способности и снаряжение',
 '3':'Персонаж и действия','4':'Магия и заклинания','notes':'Заметки кампании',
};
const SECTION_ICONS:Record<string,typeof Shield>={
 'Персонаж':UserRound,'Пункты героизма':Crown,'Характеристики':Gem,'Защиты':Shield,'Защита и здоровье':Shield,
 'Класс брони и щит':Shield,'Пункты здоровья':Heart,'Спасброски':Shield,
 'Навыки':Compass,'Языки, внимание и скорость':Eye,'Удары':Swords,'Оружие и атаки':Swords,'Классовая СЛ':Shield,
 'Черты народа и общие черты':Feather,'Классовые способности':Star,'Портрет персонажа':UserRound,'Способности по уровням':ScrollText,
 'Инвентарь и снаряжение':Backpack,
 'Богатство':Coins,'Внешность':Eye,'Личность':UserRound,'Заметки для кампании':ScrollText,
 'Действия и занятия':Zap,'Свободные и ответные действия':CircleDot,
 'Магическая традиция':Compass,'Параметры заклинаний':WandSparkles,'Ячейки заклинаний':BookMarked,'Список чар':Sparkles,
 'Заклинания':BookOpen,'Фокусы':Sparkles,'Фокусные заклинания':CircleDot,
 'Врождённые заклинания':Star,'Ритуалы':Scroll,
 'Заметки':ScrollText,'Дополнительные поля':ScrollText,
};
function Section({index,title,children,wide=false,className=''}:{index:string;title:string;children:ReactNode;wide?:boolean;className?:string}){
 const Icon=SECTION_ICONS[title]||ScrollText;
 return <section className={'pf-alt-section'+(wide?' pf-alt-wide':'')+(className?' '+className:'')}>
   <h3><Icon size={14} strokeWidth={1.8} aria-hidden="true"/><span className="pf-alt-section-index">{index}</span>{title}</h3>
   {children}
  </section>;
}
function PaperFrame({kind}:{kind:'armor'|'shield'|'save'|'heart'|'skill'|'eye'|'arrow'|'axe'|'dc'|'dart'|'bag'|'spellstar'|'scroll'|'book'}){
 const paths={
  spellstar:'M34 3 L51 23 C61 22 69 27 74 34 L98 28 L81 48 C82 60 75 70 66 75 L68 97 L51 78 C39 78 30 70 26 61 L3 64 L24 48 C24 37 31 29 40 25 Z',
  scroll:'M25 7 H85 Q93 7 89 18 L73 42 Q69 49 75 55 Q85 67 80 84 Q78 93 69 93 H14 Q6 93 10 83 L27 57 Q32 49 26 43 Q14 29 18 14 Q19 7 25 7 Z',
  book:'M3 12 L43 7 L50 14 L57 7 L97 12 V90 L57 85 L50 92 L43 85 L3 90 Z',
  bag:'M18 4 H82 L79 23 L91 37 L91 80 L78 96 H22 L9 80 V37 L21 23 Z',
  dart:'M50 4 L96 94 L64 83 V98 H36 V83 L4 94 Z',
  eye:'M32 72 L8 98 L2 88 L24 65 M53 5 A37 37 0 1 1 53 79 A37 37 0 1 1 53 5 Z',
  arrow:'M7 25 H58 V5 L96 50 L58 95 V75 H3 Z',
  axe:'M20 5 Q50 22 80 5 Q98 50 80 95 L65 83 V80 H35 V83 L20 95 Q2 50 20 5 Z',
  dc:'M13 5 H87 Q97 5 97 20 V80 Q97 95 87 95 H13 Q3 95 3 80 V20 Q3 5 13 5 Z',
  skill:'M14 4 H86 Q86 18 97 18 V82 Q86 82 86 96 H14 Q14 82 3 82 V18 Q14 18 14 4 Z',
  armor:'M35 8 L42 3 Q50 10 58 3 L65 8 L77 10 L94 38 L81 48 L72 39 L72 88 L60 91 L56 98 L44 98 L40 91 L28 88 L28 39 L19 48 L6 38 L23 10 Z',
  shield:'M9 5 H91 V40 Q88 72 50 96 Q12 72 9 40 Z',
  save:'M13 9 H87 L97 28 V72 L87 91 H13 L3 72 V28 Z',
  heart:'M50 17 C27 -8 0 7 4 36 C6 64 32 77 50 96 C68 77 94 64 96 36 C100 7 73 -8 50 17 Z'
 };
 return <svg className={'pf-paper-frame pf-paper-frame--'+kind} viewBox="0 0 100 100" preserveAspectRatio={kind==='eye'||kind==='spellstar'?'xMidYMid meet':'none'} aria-hidden="true" focusable="false">
  <path d={paths[kind]} fill="white" stroke={kind==='heart'||kind==='axe'?'#772b27':kind==='skill'?'#1b4a30':'#474643'} strokeWidth="5" vectorEffect="non-scaling-stroke"/>
  <path d={paths[kind]} fill="none" stroke="#b9b9b3" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
 </svg>;
}
export default function AlternativePathfinderPages({
 page,fields,values,displayValues,legacyHasValues,preparedSpells,spellMode,
 onChange,onOpenGrimoire,onOpenSettings,portraitUrl,onEditPortrait,onAddLevel,onRemoveLevel,disabled,
}:Props){
 const map=useMemo(()=>new Map(fields.filter(f=>f.page===page).map(f=>[f.id,f])),[fields,page]);
 const consumed=new Set<string>();
 function textSize(id:string){const size=Number(values['pf_text_size_'+id]);return Number.isFinite(size)&&size>=8&&size<=28?size:undefined;}
 if(page===2)for(const id of ADVANCEMENT_FIELD_IDS)consumed.add(id);
 const automatic=isAutomatic(values,legacyHasValues);
 const spellConfigured=isSpellcastingConfigured(values);
 function field(id:string,alias?:string){
  const f=map.get(id);if(!f)return null;
  consumed.add(id);
  const label=alias||f.label;
  const computed=(id==='armor_class'||(id==='class_dc'&&isClassDcConfigured(values))||
    (spellConfigured&&isSpellcastingComputedField(id))||
    (automatic&&id!=='class_dc'&&(isCoreComputedField(id)||
      (isNativeCombatComputedField(id)&&!isNativeWeaponAttackField(id)))));
  const disabled=computed&&id in displayValues;
  const value=displayValues[id]??values[id]??'';
  const isRank=RANK_FIELDS.has(id)||id==='spell_attack_rank'||id==='spell_dc_rank';
  if(isRank){
   const current=readRank(value)??0;
   return <div className="pf-alt-field pf-alt-rank-field" key={id}>
    <span title={f.label}>{label}</span>
    <div className="pf-alt-rank-squares" role="group" aria-label={f.label+' — уровень владения'}>
     {([1,2,3,4] as const).map(rank=><button
       type="button" key={rank} className="pf-alt-rank-square"
       disabled={disabled} aria-pressed={current===rank}
       title={RANK_LABELS[rank]}
       aria-label={f.label+': '+RANK_LABELS[rank]+(current===rank?' (снять)':'')}
       onClick={()=>onChange(id,String(current===rank?0:rank))}
       ><span aria-hidden="true">{current===rank&&!((id.startsWith('armor_rank_')||id.startsWith('skill_')||id.startsWith('weapon_rank_')||id==='perception_rank'||id==='spell_attack_rank'||id==='spell_dc_rank'))?'✓':''}</span></button>)}
    </div>
   </div>;
  }
  if(id==='dying')return <div key={id} className="pf-alt-field pf-alt-dying" role="group"
   aria-label={'При смерти: '+readDyingSkulls(values.dying)+' из '+DYING_SKULL_COUNT}>
   <span>{label}</span>
   <div className="pf-alt-dying-skulls">
    {Array.from({length:DYING_SKULL_COUNT},(_,i)=>{
     const checked=i<readDyingSkulls(values.dying);
     return <button type="button" key={i} aria-pressed={checked} title={'При смерти '+(i+1)}
      aria-label={'При смерти, отметка '+(i+1)} className={checked?'is-active':''}
      onClick={()=>onChange('dying',toggleDyingSkull(values.dying,i+1))}><Skull size={18} strokeWidth={1.7}/></button>;
    })}
   </div>
  </div>;
  return <label className={'pf-alt-field'+(f.kind==='long'?' pf-alt-field-long':'')} key={id}>
    <span title={f.label}>{label}</span>
    {f.kind==='toggle'?
      <input type="checkbox" checked={value===true} onChange={e=>onChange(id,e.target.checked)} aria-label={label}/>:
     f.kind==='long'?
      <RichField id={'pf-alt-'+id} label={label} className="pf-alt-rich" grow
        textSize={textSize(id)} onTextSizeChange={size=>onChange('pf_text_size_'+id,String(size))}
        value={String(value)} resourceContext={values} disabled={disabled}
        placeholder={page===1&&['defense_notes','perception_notes','movement'].includes(id)?label:undefined}
        onChange={v=>onChange(id,v)}/>:
     f.kind==='select'?
      <select aria-label={label} value={String(value)} disabled={disabled}
        onChange={e=>onChange(id,e.target.value)}>
        <option value="">{page===1&&id==='size'?'':'—'}</option>{(f.options||[]).map(x=><option key={x} value={x}>{x}</option>)}
      </select>:
      <input type="text" inputMode={f.kind==='number'||f.kind==='counter'?'numeric':undefined}
        value={String(value)} readOnly={disabled} aria-label={label}
        onChange={e=>onChange(id,e.target.value)}
        placeholder={page===3&&/^(action|reaction)_[1-4]_/.test(id)?'':page===3&&['ethnicity','nationality','birthplace','age','pronouns','height','weight','appearance','attitude','deity','likes','dislikes','quotes'].includes(id)?'':page===1&&/^weapon_[1-5]_traits$/.test(id)?label:page===1&&id==='shield_ac_bonus'?'+':page===1&&['resistances','conditions'].includes(id)?label:page===1&&['name','player','ancestry','heritage','background','character_class','background_notes','class_notes'].includes(id)?'':'—'}/>
    }
  </label>;
 }
 function matching(prefix:string){return Array.from(map.keys()).filter(id=>id.startsWith(prefix));}
 function remaining(){
  const extras=[...map.keys()].filter(id=>!consumed.has(id));
  if(!extras.length)return null;
  return <Section index="+" title="Дополнительные поля">
    <div className="pf-alt-fields">{extras.map(id=>field(id))}</div>
  </Section>;
 }
 function spellPanel(prefix:string,title:string,index:string){
  const keys=matching(prefix).filter(id=>!['cantrip_rank','cantrips_daily','focus_rank','focus_point_1','focus_point_2','focus_point_3'].includes(id));
  if(spellMode==='text'){
    const twoColumns=prefix==='spellbook_'||prefix==='rituals_';
    const sides=twoColumns?['left','right']:[''];
    const columns=prefix==='spellbook_'?
       [['names','Название'],['actions','Действия'],['ranks','Круг'],['prepared','Подг.']]:
      prefix==='rituals_'?
       [['name','Название'],['rank','Круг'],['cost','Стоимость']]:
      prefix==='cantrip_'?
       [['names','Название'],['actions','Действия'],['prepared','Подг.']]:
      prefix==='focus_'?
       [['spells','Название'],['actions','Действия']]:
       [['spells','Название'],['actions','Действия'],['frequency','Частота']];
    return <Section index={index} title={title} wide className={'pf-paper-spell-panel pf-paper-panel-'+prefix.replace('_','')}>
     <div className={'pf-alt-manual-spells'+(twoColumns?' pf-alt-manual-spells-double':'')}>
      {sides.map(side=><div className="pf-alt-manual-column" key={side||prefix}>
       {columns.map(([suffix,label])=>{
        const id=twoColumns?prefix+side+'_'+suffix:prefix+suffix;
        return <div key={id} className={'pf-alt-manual-cell pf-alt-manual-cell-'+suffix}>
         {field(id,label)}
        </div>;
       })}
      </div>)}
     </div>
    </Section>;
  }
  keys.forEach(id=>consumed.add(id));
  const rows=preparedSpells.filter(s=>prefix.startsWith('cantrip_')?s.spell.rank===0&&s.spell.kind==='cantrip':
   prefix.startsWith('focus_')?s.spell.kind==='focus':
   prefix.startsWith('innate_')?s.spell.kind==='special':
   prefix.startsWith('rituals_')?s.spell.kind==='ritual':
   s.spell.rank>0&&!['focus','ritual','special'].includes(s.spell.kind));
  const columns=prefix==='spellbook_'||prefix==='rituals_'?2:1;
  return <Section index={index} title={title} wide className={'pf-paper-spell-panel pf-paper-panel-'+prefix.replace('_','')}>
   <div className="pf-alt-spells">
    <div className={'pf-alt-spell-columns'+(columns===2?' pf-alt-spell-columns-double':'')}>
     {Array.from({length:columns},(_,column)=><div className="pf-alt-spell-column" key={column}>
      <button type="button" className="pf-alt-spell-area" onClick={onOpenGrimoire}
       aria-label={'Открыть гримуар: '+title+(columns>1?' — колонка '+(column+1):'')}/>
      <div className="pf-alt-spell-head">
       <span>Название</span>{prefix==='rituals_'?<><span>Круг</span><span>Стоим.</span></>:<><span>Действия</span>{prefix==='spellbook_'&&<span>Круг</span>}{prefix!=='focus_'&&<span>{prefix==='innate_'?'Частота':'Подг.'}</span>}</>}
      </div>
      {rows.filter((_,i)=>i%columns===column).map(spell=><button type="button" key={spell.id}
       className="pf-alt-spell-row" onClick={onOpenGrimoire}
       aria-label={'Открыть гримуар: '+spell.name}>
       <strong>{spell.name}</strong>{prefix==='rituals_'?<><span>{spell.spell.rank}</span><span>—</span></>:<><span>{spellCast(spell)}</span>{prefix==='spellbook_'&&<span>{spell.spell.rank}</span>}{prefix!=='focus_'&&<span>{prefix==='innate_'?'—':'✓'}</span>}</>}
      </button>)}
     </div>)}
    </div>
    <button type="button" className="pf-alt-add-spell" onClick={onOpenGrimoire}>
     <BookOpen size={15}/> {rows.length?'Изменить заклинания':'Добавить заклинание'}
    </button>
   </div>
  </Section>;
 }
 if(page==='notes')return <article className="pf-alt-page" id="pf-sheet-page-notes" aria-label="Альтернативный PF2e: заметки">
  <header className="pf-alt-heading"><small>AT YOUR SERVICE! / PF2E</small><h2>Заметки</h2><p>Дополнительная страница</p></header>
  <div className="pf-alt-two-col">{Array.from({length:PF_NOTES_BLOCK_COUNT},(_,i)=><Section key={i} index={String(i+1).padStart(2,'0')} title={noteBlockTitle(values[noteTitleKey(i)])}>
   <RichField id={'pf-alt-note-'+i} label={'Заметки '+(i+1)} className="pf-alt-rich pf-alt-notes" grow
     textSize={textSize(noteBodyKey(i))} onTextSizeChange={size=>onChange('pf_text_size_'+noteBodyKey(i),String(size))}
     value={String(values[noteBodyKey(i)]??'')} resourceContext={values}
     onChange={v=>onChange(noteBodyKey(i),v)}/>
  </Section>)}</div>
 </article>;
 const pageId=String(page);
 return <article className={'pf-alt-page'+(page===1?' pf-alt-page--first':'')} id={'pf-sheet-page-'+pageId} aria-label={'Альтернативный PF2e: '+PAGE_CAPTIONS[pageId]}>
 {page!==1&&<header className="pf-alt-heading"><small>AT YOUR SERVICE! / PATHFINDER SECOND EDITION</small>
   <h2>{page===1?'Бланк персонажа':PAGE_CAPTIONS[pageId]}</h2>
   <p>{String(page).padStart(2,'0')} / 04 · Pathfinder 2e · Remaster / Legacy</p>
 </header>}
 {page===1&&<>
   <div className="pf-alt-p1-top">
    <div className="pf-alt-p1-logo" role="img" aria-label="Pathfinder — бланк персонажа">
     <div className="pf-alt-p1-logo-art" aria-hidden="true">
      <img src={import.meta.env.BASE_URL+'pathfinder/page-1.webp'} alt="" loading="eager" />
     </div>
     <span>БЛАНК ПЕРСОНАЖА</span>
    </div>
    <div className="pf-alt-p1-name">
     <h3 className="pf-alt-p1-heading">Имя персонажа</h3>
     {field('name','Имя персонажа')}
     {field('player','Имя игрока')}
    </div>
    <div className="pf-alt-p1-level">
     <h3 className="pf-alt-p1-heading">Уровень</h3>
     <div className="pf-alt-p1-level-line">
      <div className="pf-alt-p1-level-diamond">{field('level','Уровень')}</div>
      <div className="pf-alt-p1-experience">{field('experience','Опыт')}</div>
     </div>
    </div>
    <div className="pf-alt-p1-hero">
     <h3 className="pf-alt-p1-heading">Пункты героизма</h3>
     <div className="pf-alt-hero-marks" role="group" aria-label="Пункты героизма">
      {['hero_1','hero_2','hero_3'].map((id,i)=>{
       consumed.add(id);const active=values[id]===true;
       return <button type="button" className="pf-alt-hero-point" key={id} aria-pressed={active}
        aria-label={'Пункт героизма '+(i+1)} onClick={()=>onChange(id,!active)}>
        <svg viewBox="0 0 40 35" aria-hidden="true" focusable="false">
         <polygon points="11,1.9 29,1.9 38,17.5 29,33.1 11,33.1 2,17.5"
          fill={active?'#315e47':'#ffffff'} stroke="#385742" strokeWidth="2.4"/>

        </svg>
       </button>;
      })}
     </div>
     <p><strong>Получите 1</strong> в начале встречи. <strong>Потратьте 1</strong> для повторной проверки. <strong>Потратьте все</strong>, чтобы избежать смерти.</p>
    </div>
   </div>
   <div className="pf-alt-p1-origins">
    <section><h3 className="pf-alt-p1-heading">Народ</h3>
     {field('ancestry','Народ')}<div className="pf-alt-p1-ancestry-detail">
      {field('heritage','Родословная и дескрипторы')}{field('size','Размер')}
     </div>
    </section>
    <section><h3 className="pf-alt-p1-heading">Происхождение</h3>
     {field('background','Происхождение')}{field('background_notes','Примечания')}
    </section>
    <section><h3 className="pf-alt-p1-heading">Класс</h3>
     {field('character_class','Класс')}{field('class_notes','Примечания')}
    </section>
   </div>
   <Section index="II" title="Характеристики" className="pf-alt-abilities-section" wide>
    <div className="pf-alt-abilities">
     {ABILITIES.map(([id,label])=><div className="pf-alt-ability" key={id}>
      {field('ability_'+id,label)}{field('ability_'+id+'_partial','Частич. повыш.')}
     </div>)}
    </div>
   </Section>
   <div className="pf-alt-defense-grid pf-paper-defense-row">
    <Section index="III" title="Защиты" className="pf-paper-defenses">
     <div className="pf-paper-defense-body">
      <div className="pf-paper-armor" aria-label="Класс брони и щит">
       <div className="pf-paper-armor-top">
        <div><h4>Класс брони</h4><div className="pf-paper-shape pf-paper-coat">
         <PaperFrame kind="armor"/>{field('armor_class','Класс брони')}
        </div></div>
        <div><h4>Щит</h4><div className="pf-paper-shape pf-paper-shield">
         <PaperFrame kind="shield"/>{field('shield_ac_bonus','Бонус щита')}
        </div></div>
        <div className="pf-paper-shield-details">
         {field('shield_hardness','Твёрдость')}
         <div className="pf-paper-shield-max"><span>Макс. ПЗ / ПП</span><div>
          {field('shield_max_hp','Максимальные ПЗ щита')}<b>/</b>{field('shield_broken','Порог поломки щита')}
         </div></div>
         {field('shield_hp','ПЗ щита')}
         <div className="pf-paper-armor-training"><h4>Умения в броне</h4>
          <div className="pf-paper-armor-ranks">{matching('armor_rank_').map((id,i)=>field(id,['Без брони','Лёгк.','Средн.','Тяж.'][i]||'Владение'))}</div>
         </div>
        </div>
       </div>
       <div className="pf-paper-armor-formula"><div className="pf-paper-formula">
        <div className="pf-paper-base"><b>10</b><span>Баз.</span></div><i>+</i>
        {field('armor_dex','Лвк*')}<i>+</i>{field('armor_prof','Умен.')}<i>+</i>{field('armor_item','Предм.')}
       </div><small>* Используйте максимум Лвк. в броне</small></div>
      </div>
      <div className="pf-paper-saves" aria-label="Спасброски">
       <div className="pf-alt-save-grid">
        {SAVE_NAMES.map(([id,label],i)=><div className="pf-paper-save" key={id}>
         <h4>{id==='reflex'?'Реакция':label}</h4>
         <div className="pf-paper-save-top"><div className="pf-paper-shape pf-paper-save-total">
          <PaperFrame kind="save"/>{field('save_'+id,label)}
         </div>{field('save_'+id+'_rank','Владение')}</div>
         <div className="pf-paper-formula">{field('save_'+id+'_ability',['Вын','Лвк','Мдр'][i])}<i>+</i>
          {field('save_'+id+'_prof','Умен.')}<i>+</i>{field('save_'+id+'_item','Предм.')}
         </div>
        </div>)}
       </div>
       {field('defense_notes','Примечания')}
      </div>
     </div>
    </Section>
    <Section index="V" title="Пункты здоровья" className="pf-paper-health">
     <div className="pf-paper-health-top">
      <div className="pf-paper-health-max"><span>Максимум</span><div className="pf-paper-shape pf-paper-heart">
       <PaperFrame kind="heart"/>{field('hp_max','Максимум ПЗ')}
      </div></div>
      {field('hp_current','Текущие ПЗ')}
      <div className="pf-paper-health-side">{field('hp_temp','Временные ПЗ')}
       {field('dying')}{field('wounded','Ранение')}
      </div>
     </div>
     <div className="pf-paper-health-notes">{field('resistances','Устойчивость и невосприимчивость')}{field('conditions','Состояния')}</div>
    </Section>
   </div>
   <div className="pf-alt-main-columns">
    <Section index="VI" title="Навыки" className="pf-alt-skills-section">
     <div className="pf-alt-skill-list">
      {SKILLS.map(([id,label])=><div key={id} className="pf-alt-skill-row">
       {id==='lore1'||id==='lore2'?<label className="pf-paper-lore-name"><b>Знание</b>
        <input aria-label={'Область знания '+(id==='lore1'?'I':'II')} value={String(values['skill_'+id+'_name']??'')}
         onChange={e=>onChange('skill_'+id+'_name',e.target.value)} />
       </label>:<b>{label}</b>}
       <div className="pf-paper-skill-total"><PaperFrame kind="skill"/>{field('skill_'+id+'_total',label+': итог')}</div>
       {field('skill_'+id+'_rank',label+': владение')}
       <div className="pf-paper-skill-formula">
        {field('skill_'+id+'_ability',({str:'Сил',dex:'Лвк',con:'Вын',int:'Инт',wis:'Мдр',cha:'Хар'})[SKILL_ABILITIES[id]])}<i>+</i>
        {field('skill_'+id+'_prof','Умен.')}<i>+</i>{field('skill_'+id+'_item','Предм.')}
        {map.has('skill_'+id+'_armor')&&<><i>−</i>{field('skill_'+id+'_armor','Броня')}</>}
       </div>
      </div>)}
     </div>
     <div className="pf-alt-fields">{field('skills_notes','Примечания')}</div>
    </Section>
    <div className="pf-alt-main-right">
     <div className="pf-alt-p1-utility pf-paper-utility">
      <Section index="VII" title="Языки" className="pf-alt-p1-languages">{field('languages','Языки')}</Section>
      <Section index="VII" title="Внимание" className="pf-alt-p1-perception">
       <div className="pf-paper-perception-top"><div className="pf-paper-icon pf-paper-eye"><PaperFrame kind="eye"/>{field('perception','Внимание')}</div>
        {field('perception_rank','Владение вниманием')}
        <div className="pf-paper-right-formula">{field('perception_ability','Мдр')}<i>+</i>{field('perception_prof','Умен.')}<i>+</i>{field('perception_item','Предм.')}</div>
       </div>{field('perception_notes','Восприятие')}
      </Section>
      <Section index="VII" title="Скорость" className="pf-alt-p1-speed">
       <div className="pf-paper-speed-top"><div className="pf-paper-icon pf-paper-arrow"><PaperFrame kind="arrow"/>{field('speed','Скорость')}</div><span>футов</span></div>
       {field('movement','Типы перемещения')}
      </Section>
     </div>
     <Section index="VIII" title="Удары" className="pf-paper-strikes">
      <div className="pf-alt-weapon-list">{[1,2,3,4,5].map(i=>{
        const visible=['name','attack','damage','traits','ability','prof','item','damage_bludgeoning','damage_piercing','damage_slashing'].map(suffix=>'weapon_'+i+'_'+suffix);
        const extra=matching('weapon_'+i+'_').filter(id=>!visible.includes(id));
        return <div className="pf-alt-weapon pf-paper-weapon" key={i}>
         {(i===1||i===4)&&<h4>{i===1?'В ближнем бою':'Дистанционные'}</h4>}
         <div className="pf-paper-weapon-line">
          {field('weapon_'+i+'_name','Оружие')}
          <div className="pf-paper-icon pf-paper-attack"><PaperFrame kind={i<=3?'axe':'dart'}/>{field('weapon_'+i+'_attack','Атака оружием '+i)}</div>
          <div className="pf-paper-right-formula">{field('weapon_'+i+'_ability',i<=3?'Сил / Лвк':'Лвк')}<i>+</i>{field('weapon_'+i+'_prof','Умен.')}<i>+</i>{field('weapon_'+i+'_item','Предм.')}</div>
          {field('weapon_'+i+'_damage','Урон')}
          <div className="pf-paper-damage-types">{['bludgeoning','piercing','slashing'].map((type,j)=>field('weapon_'+i+'_damage_'+type,['Д','К','Р'][j]))}</div>
         </div>
         <div className="pf-paper-descriptors">{field('weapon_'+i+'_traits','Дескрипторы')}</div>
         {extra.length>0&&<details className="pf-alt-weapon-more"><summary>Бонусы и дополнительные свойства</summary><div className="pf-alt-weapon-extra">{extra.map(id=>field(id))}</div></details>}
        </div>;
       })}</div>
      <div className="pf-paper-weapon-footer"><div><h4>Умения в оружии</h4><div className="pf-paper-weapon-ranks">{matching('weapon_rank_').map((id,i)=>field(id,['Безоруж.','Простое','Особое','Экзот.','Проч.'][i]))}</div></div>
       {field('weapon_other','Прочие умения')}{field('critical_effects','Критические эффекты')}
      </div>
     </Section>
     <div className="pf-alt-p1-bottom-right pf-paper-bottom">
      <Section index="IX" title="Классовая СЛ" className="pf-alt-p1-class-dc">
       <div className="pf-paper-icon pf-paper-dc"><PaperFrame kind="dc"/>{field('class_dc','Классовая СЛ')}</div>
       <div className="pf-paper-right-formula"><div className="pf-paper-fixed-ten"><b>10</b><span>Баз.</span></div><i>+</i>{field('class_dc_key','Ключ.') }<i>+</i>{field('class_dc_rank','Умен.')}<i>+</i>{field('class_dc_item','Предм.')}</div>
      </Section>
      <section className="pf-alt-p1-legend" aria-label="Памятка Pathfinder">
       <h3 className="pf-alt-p1-heading">Памятка</h3>
       <div><b>Умение</b><span>Необученный +0</span><span>Изученный 2 + уровень</span><span>Эксперт 4 + уровень</span><span>Мастер 6 + уровень</span><span>Легенда 8 + уровень</span></div>
       <div><b>Действия</b><span>◆ Одиночное действие</span><span>◆◆ Занятие в два действия</span><span>◆◆◆ Занятие в три действия</span><span>◇ Свободное действие</span><span>↪ Ответное действие</span></div>
      </section>
     </div>
    </div>
   </div>
 </>}
 {page===2&&<>
  <div className="pf-alt-equipment-layout">
   <div className="pf-alt-progression-column">
    <div className="pf-alt-dynamic-advancement" aria-label="Способности по уровням">
     <DynamicAdvancement values={values} count={advancementLevelCount(values)}
      pageArtUrl={import.meta.env.BASE_URL+'pathfinder/page-2.webp'} disabled={disabled}
      onTextSizeChange={(id,size)=>onChange('pf_text_size_'+id,String(size))}
      onValueChange={onChange} onAdd={onAddLevel} onRemove={onRemoveLevel}/>
    </div>
   </div>
   <div className="pf-alt-equipment-column pf-paper-equipment">
    <Section index="IV" title="Снаряжение" className="pf-alt-inventory">
     <div className="pf-alt-inventory-group pf-paper-held"><div className="pf-alt-fields">
      {field('inventory_held','Удерживаемые предметы')}{field('inventory_held_bulk','Вес')}
     </div></div>
     <div className="pf-alt-inventory-group pf-paper-consumables"><div className="pf-alt-fields">
      {field('inventory_consumables','Одноразовые предметы')}{field('inventory_consumables_bulk','Вес')}
     </div></div>
     <div className="pf-alt-inventory-group pf-paper-worn"><div className="pf-alt-fields">
      {field('inventory_worn','Носимые предметы')}{field('inventory_worn_attune','Настр.')}{field('inventory_worn_bulk','Вес')}
     </div></div>
    </Section>
    <Section index="IV" title="Вес" className="pf-paper-bulk-section">
     <div className="pf-paper-bulk-body"><div className="pf-paper-icon pf-paper-bag"><PaperFrame kind="bag"/>{field('bulk_total','Вес')}</div>
      <div className="pf-paper-bulk-guide"><span><b>Лёгкие вещи:</b> 10 предметов веса Л = вес 1</span><span><b>Нагруженность:</b> 5 + Сил</span><span><b>Макс. вес:</b> 10 + Сил</span><span><b>Макс. настроенность:</b> 10</span></div>
     </div>
    </Section>
    <Section index="V" title="Богатство" className="pf-alt-wealth">
     <div className="pf-alt-coin-row">
      {/* Legacy keys follow PDF positions: pp, gp, sp, cp = ММ, СМ, ЗМ, ПМ. */}
      {['wealth_pp','wealth_gp','wealth_sp','wealth_cp'].map((id,i)=><div className={'pf-alt-coin pf-paper-coin-'+i} key={id}>{field(id,['ММ','СМ','ЗМ','ПМ'][i])}</div>)}
     </div>
     <div className="pf-alt-fields pf-paper-valuables">{field('valuables','Самоцветы и предметы искусства')}{field('valuables_price','Цена')}{field('valuables_bulk','Вес')}</div>
    </Section>
   </div>
  </div>
 </>}
 {page===3&&<>
  <div className="pf-alt-biography-layout pf-paper-biography">
   <Section index="I" title="Портрет персонажа" className="pf-alt-portrait-section">
    <button type="button" className="pf-alt-portrait" onClick={onEditPortrait} aria-label="Изменить портрет">
     <img src={portraitUrl||import.meta.env.BASE_URL+'pathfinder/portrait-placeholder.webp'} alt="Портрет героя"/>
     <span>Изменить портрет</span>
    </button>
   </Section>
   <div className="pf-alt-biography-right">
    <Section index="II" title="Внешность">
     <div className="pf-alt-appearance-fields">
      {['ethnicity','nationality','birthplace','age','pronouns','height','weight','appearance'].map(id=>field(id))}
     </div>
    </Section>
    <Section index="III" title="Личность">
     <div className="pf-alt-personality-fields">
      {['attitude','deity','edicts','anathema','likes','dislikes','quotes'].map(id=>field(id))}
     </div>
    </Section>
   </div>
  </div>
  <Section index="IV" title="Заметки для кампании" className="pf-paper-campaign" wide>
   <div className="pf-alt-campaign-grid">
    {['campaign_notes','allies','enemies','organizations'].map(id=>field(id,id==='campaign_notes'?'Заметки':undefined))}
   </div>
  </Section>
  <div className="pf-alt-action-layout pf-paper-actions">
   <Section index="V" title="Действия и занятия"><div className="pf-alt-action-cards">
    {[1,2,3,4].map(i=><div key={i} className="pf-alt-action-card pf-paper-action" aria-label={'Действие '+i}>
     <div className="pf-paper-action-top">{field('action_'+i+'_name','Название')}{field('action_'+i+'_cost','Действия')}{field('action_'+i+'_traits','Дескрипторы')}{field('action_'+i+'_page','Стр.')}</div>
     <div className="pf-paper-action-effect">{field('action_'+i+'_effect','Эффекты')}</div>
    </div>)}
   </div></Section>
   <Section index="VI" title="Свободные и ответные действия"><div className="pf-alt-action-cards">
    {[1,2,3,4].map(i=><div key={i} className="pf-alt-action-card pf-paper-reaction" aria-label={'Свободное или ответное действие '+i}>
     <div className="pf-paper-action-top">{field('reaction_'+i+'_name','Название')}
      <div className="pf-paper-reaction-kind" role="group" aria-label={'Тип действия '+i}>
       {(['free','reaction'] as const).map(kind=><button key={kind} type="button" aria-pressed={values['reaction_'+i+'_kind']===kind}
        aria-label={(kind==='free'?'Свободное действие ':'Ответное действие ')+i} disabled={disabled}
        onClick={()=>onChange('reaction_'+i+'_kind',values['reaction_'+i+'_kind']===kind?'':kind)}><span className="pf-paper-kind-circle" aria-hidden="true"/><span aria-hidden="true">{kind==='free'?'◇':'↪'}</span></button>)}
      </div>{field('reaction_'+i+'_traits','Дескрипторы')}{field('reaction_'+i+'_page','Стр.')}
     </div>
     <div className="pf-paper-action-condition">{field('reaction_'+i+'_condition','Условие')}</div>
     <div className="pf-paper-action-effect">{field('reaction_'+i+'_effect','Эффекты')}</div>
    </div>)}
   </div></Section>
  </div>
 </>}
 {page===4&&<>
  <div className="pf-alt-magic-layout pf-paper-magic">
   <div className="pf-alt-magic-left">
    <Section index="I" title="Магическая традиция">
     <div className="pf-alt-tradition-panel">
      <div className="pf-alt-tradition-wheel" role="group" aria-label="Выбор магических традиций">
       {([['arcane','Мистическая'],['occult','Оккультная'],['primal','Первобытная'],['divine','Сакральная']] as const).map(([id,label])=>{
        const key='tradition_'+id;consumed.add(key);
        return <button key={id} type="button" aria-pressed={effectivePfTraditions(values).includes(id)}
         className={'pf-alt-tradition-option pf-alt-tradition-'+id+(effectivePfTraditions(values).includes(id)?' is-active':'')}
         onClick={()=>onChange(key,!effectivePfTraditions(values).includes(id))}
         title={label}>{label}</button>;
       })}
       <div className="pf-alt-tradition-emblem">{([['arcane','Мистическая'],['occult','Оккультная'],['primal','Первобытная'],['divine','Сакральная']] as const).map(([id,label])=><button key={id} type="button" className={'pf-tradition-sector pf-tradition-sector-'+id} aria-label={'Сектор: '+label} aria-pressed={effectivePfTraditions(values).includes(id)} onClick={()=>onChange('tradition_'+id,!effectivePfTraditions(values).includes(id))} title={label}/>)}</div>
      </div>
      <div className="pf-alt-spell-type">{field('prepared','Подготавливающий')}{field('spontaneous','Спонтанный')}</div>
     </div>
    </Section>
    <Section index="II" title="Параметры заклинаний" className="pf-paper-casting-section">
     <div className="pf-paper-casting">
      <div className="pf-paper-cast-group"><h4>Атака заклинанием</h4><div className="pf-paper-cast-line">
       <div className="pf-paper-icon pf-paper-spellstar"><PaperFrame kind="spellstar"/>{field('spell_attack','Атака заклинанием')}</div>{field('spell_attack_rank','Ранг атаки')}
       <div className="pf-paper-right-formula">{field('spell_attack_key','Ключ.')}<i>+</i><div className="pf-paper-prof"><output>{spellcastingTotals(values).attackProficiency??'—'}</output><span>Умен.</span></div></div>
      </div></div>
      <div className="pf-paper-cast-group"><h4>СЛ заклинаний</h4><div className="pf-paper-cast-line">
       <div className="pf-paper-icon pf-paper-scroll"><PaperFrame kind="scroll"/>{field('spell_dc','СЛ заклинаний')}</div>{field('spell_dc_rank','Ранг СЛ')}
       <div className="pf-paper-right-formula"><div className="pf-paper-prof"><output>10</output><span>Баз.</span></div><i>+</i>{field('spell_dc_key','Ключ.')}<i>+</i><div className="pf-paper-prof"><output>{spellcastingTotals(values).dcProficiency??'—'}</output><span>Умен.</span></div></div>
      </div></div>
     </div>
     <div className="pf-paper-magic-tools"><button type="button" className="pf-alt-add-spell" onClick={onOpenGrimoire} aria-label="Открыть гримуар"><BookOpen size={16}/></button><button type="button" className="pf-alt-add-spell" onClick={onOpenSettings} aria-label="Настройки магии"><Settings2 size={16}/></button>
      <details><summary>Предмет к СЛ</summary>{field('spell_dc_item','Предмет к СЛ')}</details>
     </div>
    </Section>
    <Section index="III" title="Фокусы" className="pf-paper-cantrips">
     <div className="pf-paper-cantrip-controls"><span>Подг. в день</span><div className="pf-paper-icon pf-paper-book"><PaperFrame kind="book"/>{field('cantrips_daily','Фокусы в день')}</div><small>1/2 вашего уровня с округлением вверх</small>{field('cantrip_rank','Круг фокусов')}</div>
     {spellPanel('cantrip_','Список чар','03a')}
    </Section>
    <Section index="IV" title="Фокальные заклинания" className="pf-paper-focus">
     <div className="pf-paper-focus-controls"><b>ФП</b><div className="pf-alt-focus-points">{['focus_point_1','focus_point_2','focus_point_3'].map((id,i)=>field(id,'Фокусное очко '+(i+1)))}</div>{field('focus_rank','Круг фокальных заклинаний')}</div><small className="pf-paper-focus-hint">1/2 вашего уровня с округлением вверх</small><p className="pf-paper-refocus"><b>Запас ФП:</b> равен числу ваших фокальных заклинаний (максимум 3).<br/><b>Фокусировка:</b> потратьте 10 минут, чтобы восстановить 1 ФП.</p>
     {spellPanel('focus_','Фокусные заклинания','04a')}
    </Section>
    {spellPanel('innate_','Врождённые заклинания','V')}
   </div>
   <div className="pf-alt-magic-right">
    <Section index="VI" title="Ячейки заклинаний" className="pf-alt-magic-slots">
     <div className="pf-alt-slots pf-paper-slots"><div className="pf-paper-slot-labels"><span>Заклинаний<br/>в день</span><b>Круг заклинаний</b><span>Осталось</span></div>
      {Array.from({length:10},(_,i)=>i+1).map(n=><div className="pf-alt-slot" key={n}>
       <div className="pf-paper-icon pf-paper-book"><PaperFrame kind="book"/>{field('spell_slots_'+n,'Всего заклинаний '+n)}</div><b>{n}</b>{field('spell_remaining_'+n,'Осталось ячеек '+n)}
      </div>)}
     </div>
    </Section>
    {spellPanel('spellbook_','Заклинания','VII')}
    {spellPanel('rituals_','Ритуалы','VIII')}
   </div>
  </div>
 </>}
 {remaining()}
 <footer className="pf-alt-page-footer"><span>AT YOUR SERVICE!</span><span>{PAGE_CAPTIONS[pageId]} · {pageId} / 4</span></footer>
 </article>;
}
