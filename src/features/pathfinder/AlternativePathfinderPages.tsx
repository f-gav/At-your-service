import {useMemo} from 'react';
import type {ReactNode} from 'react';
import {BookOpen, Settings2} from 'lucide-react';
import RichField from './RichField';
import {RANK_FIELDS, RANK_LABELS,readRank,isAutomatic,isCoreComputedField} from './rules-core';
import {isSpellcastingComputedField,isSpellcastingConfigured} from './rules-spellcasting';
import {isNativeCombatComputedField,isNativeWeaponAttackField,isClassDcConfigured} from './rules-combat';
import {PF_NOTES_BLOCK_COUNT,noteBodyKey,noteTitleKey,noteBlockTitle} from './notes-blocks';
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
function Section({index,title,children,wide=false}:{index:string;title:string;children:ReactNode;wide?:boolean}){
  return <section className={'pf-alt-section'+(wide?' pf-alt-wide':'')}>
    <h3><span>{index}</span>{title}</h3>{children}
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
      <RichField id={'pf-alt-'+id} label={label} className="pf-alt-rich"
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
  const keys=matching(prefix);
  if(spellMode==='text')return <Section index={index} title={title} wide>
    <div className="pf-alt-fields pf-alt-spell-text">{keys.map(id=>field(id))}</div>
   </Section>;
  keys.forEach(id=>consumed.add(id));
  const rows=preparedSpells.filter(s=>prefix.startsWith('cantrip_')?s.spell.rank===0&&s.spell.kind==='cantrip':
   prefix.startsWith('focus_')?s.spell.kind==='focus':
   prefix.startsWith('innate_')?s.spell.kind==='special':
   prefix.startsWith('rituals_')?s.spell.kind==='ritual':
   s.spell.rank>0&&!['focus','ritual','special'].includes(s.spell.kind));
  return <Section index={index} title={title} wide>
    <div className="pf-alt-spells">
      <div className="pf-alt-spell-head"><span>Название</span><span>Круг</span><span>Действия</span><span>Подг.</span></div>
      {rows.map(s=><button type="button" key={s.id} className="pf-alt-spell-row" onClick={()=>onOpenSpell(s)}
        aria-label={'Прочитать заклинание '+s.name}>
         <strong>{s.name}</strong><span>{s.spell.rank||'Ч'}</span><span>{spellCast(s)}</span><span>✓</span>
        </button>)}
      <button type="button" className="pf-alt-add-spell" onClick={onOpenGrimoire}><BookOpen size={15}/> {rows.length?'Изменить заклинания':'Добавить заклинание'}</button>
    </div>
   </Section>;
 }
 if(page==='notes')return <article className="pf-alt-page" id="pf-sheet-page-notes" aria-label="Альтернативный PF2e: заметки">
  <header className="pf-alt-heading"><small>AT YOUR SERVICE! / PF2E</small><h2>Заметки</h2><p>Дополнительная страница</p></header>
  <div className="pf-alt-two-col">{Array.from({length:PF_NOTES_BLOCK_COUNT},(_,i)=><Section key={i} index={String(i+1).padStart(2,'0')} title={noteBlockTitle(values[noteTitleKey(i)])}>
   <RichField id={'pf-alt-note-'+i} label={'Заметки '+(i+1)} className="pf-alt-rich pf-alt-notes"
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
  <Section index="01" title="Персонаж" wide>
   <div className="pf-alt-fields pf-alt-identity">
    {['name','player','level','experience','ancestry','heritage','background','character_class','size'].map(id=>field(id))}
   </div>
   <div className="pf-alt-fields">{['hero_1','hero_2','hero_3','background_notes','class_notes'].map(id=>field(id))}</div>
  </Section>
  <Section index="02" title="Характеристики" wide><div className="pf-alt-abilities">
   {ABILITIES.map(([id,label])=><div className="pf-alt-ability" key={id}>
    {field('ability_'+id,label)}{field('ability_'+id+'_partial','Частичное повышение')}
   </div>)}
  </div></Section>
  <div className="pf-alt-two-col">
   <Section index="03" title="Защита и здоровье">
    <div className="pf-alt-fields">
     {['armor_class','armor_dex','armor_prof','armor_item','hp_max','hp_current','hp_temp','dying','wounded','shield_hardness','shield_max_hp','shield_hp','shield_broken'].map(id=>field(id))}
    </div>
    <div className="pf-alt-fields">{matching('armor_rank_').map(id=>field(id))}</div>
    {cells(['defense_notes','resistances','conditions'])}
   </Section>
   <Section index="04" title="Спасброски">
    {SAVE_NAMES.map(([id,label])=><div className="pf-alt-stat-block" key={id}><h4>{label}</h4>
      {cells(matching('save_'+id),'pf-alt-fields pf-alt-stat-fields')}
    </div>)}
    {cells(['perception','perception_rank','perception_ability','perception_prof','perception_item','perception_notes','speed','movement'])}
   </Section>
  </div>
  <Section index="05" title="Навыки" wide>
   <div className="pf-alt-skill-list">{SKILLS.map(([id,label])=><div key={id} className="pf-alt-skill-row">
    <b>{label}</b><div className="pf-alt-fields">{matching('skill_'+id+'_').map(k=>field(k,k.split('_').pop()))}</div>
   </div>)}</div>
   {cells(['skills_notes','languages'])}
  </Section>
  <Section index="06" title="Оружие и атаки" wide>
   <div className="pf-alt-two-col">{[1,2,3,4,5].map(i=><div className="pf-alt-weapon" key={i}>
    <h4>Оружие {i}</h4><div className="pf-alt-fields">{matching('weapon_'+i+'_').map(id=>field(id))}</div>
   </div>)}</div>
   {cells(['weapon_other','critical_effects','class_dc','class_dc_key','class_dc_rank','class_dc_item'])}
   <div className="pf-alt-fields">{matching('weapon_rank_').map(id=>field(id))}</div>
  </Section>
 </>}
 {page===2&&<>
  <Section index="01" title="Народ, происхождение и класс" wide>
   {cells(['ancestry_features','ancestry_feat_1','background_skill_feat','class_features_1'])}
  </Section>
  <Section index="02" title="Развитие персонажа" wide><div className="pf-alt-advancement">
   {Array.from({length:19},(_,i)=>i+2).map(n=><div key={n} className="pf-alt-advancement-row"><b>{n} ур.</b>
    {field('feat_level_'+n,'Черта')}{field('class_level_'+n,'Классовая способность')}
   </div>)}
  </div></Section>
  <Section index="03" title="Инвентарь и снаряжение" wide>
   {cells(['inventory_held','inventory_held_bulk','inventory_consumables','inventory_consumables_bulk','inventory_worn','inventory_worn_attune','inventory_worn_bulk','bulk_total'])}
  </Section>
  <Section index="04" title="Монеты и ценности" wide>
   {cells(['wealth_pp','wealth_gp','wealth_sp','wealth_cp','valuables','valuables_price','valuables_bulk'])}
  </Section>
 </>}
 {page===3&&<>
  <Section index="01" title="Внешность и биография" wide>
   <div className="pf-alt-portrait-row">
    <button type="button" className="pf-alt-portrait" onClick={onEditPortrait} aria-label="Изменить портрет">
      <img src={portraitUrl||import.meta.env.BASE_URL+'pathfinder/portrait-placeholder.webp'} alt="Портрет героя"/>
      <span>Изменить портрет</span>
    </button>
    <div className="pf-alt-fields">{['ethnicity','nationality','birthplace','age','pronouns','height','weight','appearance'].map(id=>field(id))}</div>
   </div>
  </Section>
  <Section index="02" title="Характер и убеждения" wide>
   {cells(['attitude','deity','edicts','anathema','likes','dislikes','quotes'])}
  </Section>
  <Section index="03" title="Кампания и связи" wide>
   {cells(['campaign_notes','allies','enemies','organizations'])}
  </Section>
  <Section index="04" title="Действия и реакции" wide><div className="pf-alt-two-col">
   {[1,2,3,4].map(i=><div key={i} className="pf-alt-stat-block">
    <h4>Действие {i}</h4>{cells(matching('action_'+i+'_'))}
    <h4>Реакция {i}</h4>{cells(matching('reaction_'+i+'_'))}
   </div>)}
  </div></Section>
 </>}
 {page===4&&<>
  <Section index="01" title="Параметры магии" wide>
   {cells(['tradition_arcane','tradition_divine','tradition_occult','tradition_primal','prepared','spontaneous',
     'spell_attack','spell_attack_rank','spell_attack_key','spell_dc','spell_dc_rank','spell_dc_key','spell_dc_item'])}
   <button type="button" className="pf-alt-add-spell" onClick={onOpenSettings}><Settings2 size={16}/> Настройки заклинаний</button>
  </Section>
  <Section index="02" title="Ячейки заклинаний" wide>
   <div className="pf-alt-slots">{Array.from({length:10},(_,i)=>i+1).map(n=><div className="pf-alt-slot" key={n}>
    <b>{n}-й круг</b>{field('spell_slots_'+n,'Ячеек')}{field('spell_remaining_'+n,'Осталось')}
   </div>)}</div>
  </Section>
  <Section index="03" title="Чары и фокусы" wide>
   {cells(['cantrips_daily','cantrip_rank'])}
  </Section>
  {spellPanel('cantrip_','Список чар','04')}
  {spellPanel('spellbook_','Заклинания','05')}
  <Section index="06" title="Очки фокуса" wide>{cells(['focus_point_1','focus_point_2','focus_point_3','focus_rank'])}</Section>
  {spellPanel('focus_','Фокусные заклинания','07')}
  {spellPanel('innate_','Врождённая магия','08')}
  {spellPanel('rituals_','Ритуалы','09')}
 </>}
 {remaining()}
 <footer className="pf-alt-page-footer"><span>AT YOUR SERVICE!</span><span>{PAGE_CAPTIONS[pageId]} · {pageId} / 4</span></footer>
 </article>;
}
