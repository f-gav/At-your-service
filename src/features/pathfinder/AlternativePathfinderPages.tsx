import {useMemo} from 'react';
import type {ReactNode} from 'react';
import {BookOpen, Settings2, Shield, Heart, Swords, ScrollText, Coins, Eye, Feather, Sparkles, Backpack, WandSparkles, UserRound, Gem, Compass, BookMarked, Scroll, Star, CircleDot, Zap, Skull, Crown} from 'lucide-react';
import RichField from './RichField';
import {RANK_FIELDS, RANK_LABELS,readRank,isAutomatic,isCoreComputedField} from './rules-core';
import {isSpellcastingComputedField,isSpellcastingConfigured} from './rules-spellcasting';
import {isNativeCombatComputedField,isNativeWeaponAttackField,isClassDcConfigured} from './rules-combat';
import {PF_NOTES_BLOCK_COUNT,noteBodyKey,noteTitleKey,noteBlockTitle} from './notes-blocks';
import {DYING_SKULL_COUNT,readDyingSkulls,toggleDyingSkull} from './dying-skulls';
import type {SheetValues,FieldValue} from './sheet-values';
import type {EditableField} from './editor-schema';
import type {SpellView} from '../spell-library/catalog';
import {spellCast} from './SpellGrimoire';
import './AlternativePathfinderPages.css';

type Props={
  page:number|'notes';fields:EditableField[];values:SheetValues;displayValues:SheetValues;
  legacyHasValues:boolean;preparedSpells:SpellView[];spellMode:'library'|'text';
  onChange:(id:string,value:FieldValue)=>void;onOpenGrimoire:()=>void;
  onOpenSpell:(spell:SpellView)=>void;onOpenSettings:()=>void;
  portraitUrl?:string;onEditPortrait:()=>void;
};
const ABILITIES=[['str','Сила'],['dex','Ловкость'],['con','Выносливость'],['int','Интеллект'],['wis','Мудрость'],['cha','Харизма']] as const;
const SAVE_NAMES=[['fort','Стойкость'],['reflex','Рефлексы'],['will','Воля']] as const;
const SKILLS=[
 ['acrobatics','Акробатика'],['arcana','Аркана'],['athletics','Атлетика'],['crafting','Ремесло'],
 ['deception','Обман'],['diplomacy','Дипломатия'],['intimidation','Запугивание'],['lore1','Знания I'],
 ['lore2','Знания II'],['medicine','Медицина'],['nature','Природа'],['occultism','Оккультизм'],
 ['performance','Выступление'],['religion','Религия'],['society','Общество'],
 ['stealth','Скрытность'],['survival','Выживание'],['thievery','Воровство']
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
export default function AlternativePathfinderPages({
 page,fields,values,displayValues,legacyHasValues,preparedSpells,spellMode,
 onChange,onOpenGrimoire,onOpenSpell,onOpenSettings,portraitUrl,onEditPortrait,
}:Props){
 const map=useMemo(()=>new Map(fields.filter(f=>f.page===page).map(f=>[f.id,f])),[fields,page]);
 const consumed=new Set<string>();
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
  const isRank=RANK_FIELDS.has(id)||id==='spell_attack_rank'||id==='spell_dc_rank'||id==='class_dc_rank';
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
     isRank?
      <select value={String(readRank(value)??0)} aria-label={label}
        onChange={e=>onChange(id,e.target.value)}>
        {RANK_LABELS.map((l,i)=><option key={i} value={i}>{l}</option>)}
      </select>:
     f.kind==='long'?
      <RichField id={'pf-alt-'+id} label={label} className="pf-alt-rich" grow
        value={String(value)} resourceContext={values} disabled={disabled}
        onChange={v=>onChange(id,v)}/>:
     f.kind==='select'?
      <select aria-label={label} value={String(value)} disabled={disabled}
        onChange={e=>onChange(id,e.target.value)}>
        <option value="">—</option>{(f.options||[]).map(x=><option key={x} value={x}>{x}</option>)}
      </select>:
      <input type="text" inputMode={f.kind==='number'||f.kind==='counter'?'numeric':undefined}
        value={String(value)} readOnly={disabled} aria-label={label}
        onChange={e=>onChange(id,e.target.value)} placeholder="—"/>
    }
  </label>;
 }
 function cells(ids:readonly string[],cls='pf-alt-fields'){
  return <div className={cls}>{ids.map(id=>field(id))}</div>;
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
    return <Section index={index} title={title} wide>
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
  return <Section index={index} title={title} wide>
   <div className="pf-alt-spells">
    <div className={'pf-alt-spell-columns'+(columns===2?' pf-alt-spell-columns-double':'')}>
     {Array.from({length:columns},(_,column)=><div className="pf-alt-spell-column" key={column}>
      <div className="pf-alt-spell-head">
       <span>Название</span><span>Круг</span><span>Действия</span><span>Подг.</span>
      </div>
      {rows.filter((_,i)=>i%columns===column).map(spell=><button type="button" key={spell.id}
       className="pf-alt-spell-row" onClick={()=>onOpenSpell(spell)}
       aria-label={'Прочитать заклинание '+spell.name}>
       <strong>{spell.name}</strong><span>{spell.spell.rank||'Ч'}</span>
       <span>{spellCast(spell)}</span><span>✓</span>
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
     value={String(values[noteBodyKey(i)]??'')} resourceContext={values}
     onChange={v=>onChange(noteBodyKey(i),v)}/>
  </Section>)}</div>
 </article>;
 const pageId=String(page);
 return <article className="pf-alt-page" id={'pf-sheet-page-'+pageId} aria-label={'Альтернативный PF2e: '+PAGE_CAPTIONS[pageId]}>
 <header className="pf-alt-heading"><small>AT YOUR SERVICE! / PATHFINDER SECOND EDITION</small>
   <h2>{page===1?'Бланк персонажа':PAGE_CAPTIONS[pageId]}</h2>
   <p>{String(page).padStart(2,'0')} / 04 · Pathfinder 2e · Remaster / Legacy</p>
 </header>
 {page===1&&<>
   <div className="pf-alt-page1-top">
    <div className="pf-alt-identity-main">
     <Section index="I" title="Персонаж">
      <div className="pf-alt-identity-grid">
       {['name','player','level','experience','ancestry','background','character_class','heritage','size'].map(id=>field(id))}
      </div>
      <div className="pf-alt-identity-notes">
       {['background_notes','class_notes'].map(id=>field(id))}
      </div>
     </Section>
    </div>
    <Section index="★" title="Пункты героизма" className="pf-alt-hero">
      <div className="pf-alt-hero-marks" role="group" aria-label="Пункты героизма">
       {['hero_1','hero_2','hero_3'].map((id,i)=>{
        consumed.add(id);
        const active=values[id]===true;
        return <button type="button" className="pf-alt-hero-point" key={id} aria-pressed={active}
          aria-label={'Пункт героизма '+(i+1)} onClick={()=>onChange(id,!active)}>
          <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
           <polygon points="11,3 29,3 38,20 29,37 11,37 2,20"
             fill={active?'#315e47':'#ffffff'} stroke="#385742" strokeWidth="2.6"/>
           {active&&<path d="M12 20l5 5 11-12" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>}
          </svg>
         </button>;
       })}
      </div>
      <p>Получите 1 в начале встречи. Потратьте 1 на перебросок проверки или все, чтобы избежать смерти.</p>
    </Section>
   </div>
   <Section index="II" title="Характеристики" className="pf-alt-abilities-section" wide>
    <div className="pf-alt-abilities">
     {ABILITIES.map(([id,label])=><div className="pf-alt-ability" key={id}>
      {field('ability_'+id,label)}{field('ability_'+id+'_partial','Частичное повышение')}
     </div>)}
    </div>
   </Section>
   <div className="pf-alt-defense-grid">
    <Section index="III" title="Класс брони и щит">
     <div className="pf-alt-fields pf-alt-defense-values">{['armor_class','armor_dex','armor_prof','armor_item'].map(id=>field(id))}</div>
     <h4 className="pf-alt-subhead"><Shield size={13}/> Щит</h4>
     <div className="pf-alt-fields pf-alt-shield-values">{['shield_hardness','shield_max_hp','shield_hp','shield_broken'].map(id=>field(id))}</div>
     <div className="pf-alt-fields pf-alt-ranks">{matching('armor_rank_').map(id=>field(id))}</div>
     {cells(['defense_notes'])}
    </Section>
    <Section index="IV" title="Спасброски">
     <div className="pf-alt-save-grid">
      {SAVE_NAMES.map(([id,label])=><div className="pf-alt-save" key={id}>
       <h4>{label}</h4>
       {matching('save_'+id).map(key=>field(key,key.endsWith('_rank')?'Владение':undefined))}
      </div>)}
     </div>
    </Section>
    <Section index="V" title="Пункты здоровья">
      <div className="pf-alt-health">
       {['hp_max','hp_current','hp_temp'].map(id=>field(id))}
      </div>
      <div className="pf-alt-life-state">
       {['dying','wounded'].map(id=>field(id))}
      </div>
      {cells(['resistances','conditions'])}
    </Section>
   </div>
   <div className="pf-alt-main-columns">
    <Section index="VI" title="Навыки" className="pf-alt-skills-section">
     <div className="pf-alt-skill-list">
      <div className="pf-alt-skill-head" aria-hidden="true">
       <b>Навык</b><span>Итог</span><span>Влад.</span><span>Хар.</span><span>Ур.</span><span>Пред.</span><span>Штр.</span>
      </div>
      {SKILLS.map(([id,label])=><div key={id} className="pf-alt-skill-row">
       <b>{label}</b>
       <div className="pf-alt-fields">
        {matching('skill_'+id+'_').map(key=>field(key,key.split('_').pop()))}
       </div>
      </div>)}
     </div>
     {cells(['skills_notes'])}
    </Section>
    <div className="pf-alt-main-right">
     <Section index="VII" title="Языки, внимание и скорость">
      {cells(['languages','perception','perception_rank','perception_ability','perception_prof','perception_item','perception_notes','speed','movement'])}
     </Section>
     <Section index="VIII" title="Удары">
      <div className="pf-alt-weapon-list">{[1,2,3,4,5].map(i=>{
        const core=['name','attack','damage','traits'].map(suffix=>'weapon_'+i+'_'+suffix);
        const extra=matching('weapon_'+i+'_').filter(id=>!core.includes(id));
        return <div className="pf-alt-weapon" key={i}>
         <h4><Swords size={13} aria-hidden="true"/> {i<=3?'Ближний бой':'Дистанционное'} · {i}</h4>
         <div className="pf-alt-weapon-core">
          {core.map((id,j)=>field(id,['Оружие','Атака','Урон','Свойства'][j]))}
         </div>
         {extra.length>0&&<details className="pf-alt-weapon-more">
          <summary>Бонусы и дополнительные свойства</summary>
          <div className="pf-alt-weapon-extra">{extra.map(id=>field(id))}</div>
         </details>}
        </div>;
       })}</div>
      {cells(['weapon_other','critical_effects'])}
      <div className="pf-alt-fields pf-alt-ranks">{matching('weapon_rank_').map(id=>field(id))}</div>
     </Section>
     <Section index="IX" title="Классовая СЛ">
      {cells(['class_dc','class_dc_key','class_dc_rank','class_dc_item'])}
     </Section>
    </div>
   </div>
 </>}
 {page===2&&<>
  <div className="pf-alt-equipment-layout">
   <div className="pf-alt-progression-column">
    <Section index="I" title="Черты народа и общие черты" className="pf-alt-features">
     {cells(['ancestry_features','ancestry_feat_1','background_skill_feat'])}
    </Section>
    <Section index="II" title="Классовые способности" className="pf-alt-features">
     {cells(['class_features_1'])}
    </Section>
    <Section index="III" title="Способности по уровням">
     <div className="pf-alt-level-track">
      {Array.from({length:19},(_,i)=>i+2).map(n=><div key={n} className="pf-alt-advancement-row">
       <div className="pf-alt-level-diamond"><b>{n}</b></div>
       <div className="pf-alt-advancement-fields">
        {field('feat_level_'+n,'Черта навыка / народа / общая')}
        {field('class_level_'+n,'Классовая черта / способность')}
       </div>
      </div>)}
     </div>
    </Section>
   </div>
   <div className="pf-alt-equipment-column">
    <Section index="IV" title="Инвентарь и снаряжение" className="pf-alt-inventory">
     <div className="pf-alt-inventory-group">
      <h4>Удерживаемые предметы</h4>
      {cells(['inventory_held','inventory_held_bulk'])}
     </div>
     <div className="pf-alt-inventory-group">
      <h4>Одноразовые предметы</h4>
      {cells(['inventory_consumables','inventory_consumables_bulk'])}
     </div>
     <div className="pf-alt-inventory-group">
      <h4>Носимые предметы</h4>
      {cells(['inventory_worn','inventory_worn_attune','inventory_worn_bulk'])}
     </div>
     <div className="pf-alt-bulk">{field('bulk_total','Общий вес')}</div>
    </Section>
    <Section index="V" title="Богатство" className="pf-alt-wealth">
     <div className="pf-alt-coin-row">
      {['wealth_pp','wealth_gp','wealth_sp','wealth_cp'].map((id,i)=><div className={'pf-alt-coin pf-alt-coin-'+i} key={id}>{field(id,['ПМ','ЗМ','СМ','ММ'][i])}</div>)}
     </div>
     {cells(['valuables','valuables_price','valuables_bulk'])}
    </Section>
   </div>
  </div>
 </>}
 {page===3&&<>
  <div className="pf-alt-biography-layout">
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
  <Section index="IV" title="Заметки для кампании" wide>
   <div className="pf-alt-campaign-grid">
    {['campaign_notes','allies','enemies','organizations'].map(id=>field(id))}
   </div>
  </Section>
  <div className="pf-alt-action-layout">
   <Section index="V" title="Действия и занятия">
    <div className="pf-alt-action-cards">
     {[1,2,3,4].map(i=><div key={i} className="pf-alt-action-card">
      <h4><Zap size={14} aria-hidden="true"/> Действие {i}</h4>
      <div className="pf-alt-action-fields">{matching('action_'+i+'_').map(id=>field(id,({name:'Название',cost:'Действия',traits:'Дескрипторы',page:'Стр.',effect:'Эффект',condition:'Условие'} as Record<string,string>)[id.split('_').pop()||'']||undefined))}</div>
     </div>)}
    </div>
   </Section>
   <Section index="VI" title="Свободные и ответные действия">
    <div className="pf-alt-action-cards">
     {[1,2,3,4].map(i=><div key={i} className="pf-alt-action-card">
      <h4><CircleDot size={14} aria-hidden="true"/> Реакция {i}</h4>
      <div className="pf-alt-action-fields">{matching('reaction_'+i+'_').map(id=>field(id,({name:'Название',cost:'Действия',traits:'Дескрипторы',page:'Стр.',effect:'Эффект',condition:'Условие'} as Record<string,string>)[id.split('_').pop()||'']||undefined))}</div>
     </div>)}
    </div>
   </Section>
  </div>
 </>}
 {page===4&&<>
  <div className="pf-alt-magic-layout">
   <div className="pf-alt-magic-left">
    <Section index="I" title="Магическая традиция">
     <div className="pf-alt-tradition-panel">
      <div className="pf-alt-tradition-wheel" role="group" aria-label="Выбор магических традиций">
       {([['arcane','Мистическая'],['occult','Оккультная'],['primal','Первобытная'],['divine','Сакральная']] as const).map(([id,label])=>{
        const key='tradition_'+id;consumed.add(key);
        return <button key={id} type="button" aria-pressed={values[key]===true}
         className={'pf-alt-tradition-option pf-alt-tradition-'+id+(values[key]===true?' is-active':'')}
         onClick={()=>onChange(key,values[key]!==true)}
         title={label}>{label}</button>;
       })}
       <div className="pf-alt-tradition-emblem" aria-hidden="true">✣</div>
      </div>
      <div className="pf-alt-spell-type">{field('prepared','Подготавливающий')}{field('spontaneous','Спонтанный')}</div>
     </div>
    </Section>
    <Section index="II" title="Параметры заклинаний">
     <div className="pf-alt-casting-fields">
      {['spell_attack','spell_attack_rank','spell_attack_key','spell_dc','spell_dc_rank','spell_dc_key','spell_dc_item'].map(id=>field(id))}
     </div>
     <button type="button" className="pf-alt-add-spell" onClick={onOpenSettings}><Settings2 size={15}/> Настройки магии</button>
    </Section>
    <Section index="III" title="Фокусы">
     {cells(['cantrips_daily','cantrip_rank'])}
     {spellPanel('cantrip_','Список чар','03a')}
    </Section>
    <Section index="IV" title="Фокусные заклинания">
     <div className="pf-alt-focus-points">{['focus_point_1','focus_point_2','focus_point_3','focus_rank'].map(id=>field(id))}</div>
     {spellPanel('focus_','Фокусные заклинания','04a')}
    </Section>
    {spellPanel('innate_','Врождённые заклинания','V')}
   </div>
   <div className="pf-alt-magic-right">
    <Section index="VI" title="Ячейки заклинаний" className="pf-alt-magic-slots">
     <div className="pf-alt-slots">{Array.from({length:10},(_,i)=>i+1).map(n=><div className="pf-alt-slot" key={n}>
      <b>{n}</b>{field('spell_slots_'+n,'Всего')}{field('spell_remaining_'+n,'Осталось')}
     </div>)}</div>
    </Section>
    {spellPanel('spellbook_','Заклинания','VII')}
   </div>
  </div>
  {spellPanel('rituals_','Ритуалы','VIII')}
 </>}
 {remaining()}
 <footer className="pf-alt-page-footer"><span>AT YOUR SERVICE!</span><span>{PAGE_CAPTIONS[pageId]} · {pageId} / 4</span></footer>
 </article>;
}
