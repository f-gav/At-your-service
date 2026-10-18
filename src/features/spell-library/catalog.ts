/** Spell Library v1. No seeded spells. System mechanics, rules revisions and
 * Russian/English texts are deliberately separate entities. */
export type SpellSystem = 'pf2e' | 'dnd5e';
export type SpellKind = 'cantrip'|'spell'|'focus'|'ritual'|'special';
export type SpellRarity = 'common'|'uncommon'|'rare'|'unique';
export type PfTradition = 'arcane'|'divine'|'occult'|'primal';
export type SpellLanguage = 'ru'|'en';

export type SpellIdentity = {
  id:string;
  system:SpellSystem;
  slug:string;
  kind:SpellKind;
  rank:number;
  /** PF2e: many traditions may access one spell. D&D: use classes instead. */
  traditions:PfTradition[];
  /** D&D class spell lists; PF2e for class-granted spell filtering. */
  classes:string[];
  school?:string; // D&D only (and optionally PF2e legacy reference).
  traits:string[];
  rarity:SpellRarity;
  sourceId:string;
  /** Optional class feature granting a focus spell / innate magic. */
  grants?:string[];
};
export type SpellRulesVersion = {
  id:string;
  spellId:string;
  edition:string; // e.g. 'pf2e-remaster', 'pf2e-legacy', 'dnd-2024'
  cast?:{actions?:number;time?:string;components?:string[]};
  range?:string;
  targets?:string;
  area?:string;
  savingThrow?:string;
  duration?:string;
  sustain?:boolean;
  concentration?:boolean;
  ritual?:boolean;
  heightened?:Record<string,string>;
  outcomes?:Partial<Record<'criticalSuccess'|'success'|'failure'|'criticalFailure',string>>;
  requirements?:string;
  trigger?:string;
  resource?:'spell-slot'|'focus-point'|'none'|'other';
  sourceId?:string;
};
export type SpellTranslation = {
  spellId:string;
  versionId:string;
  locale:SpellLanguage;
  name:string;
  summary?:string;
  description?:string;
  aliases?:string[];
  translationStatus?:'verified'|'draft'|'missing';
  /** Provenance for self-authored localizations, distinct from review status. */
  translationOrigin?:'at-your-service';
  translatorCredit?:string;
};
export type SpellSource = {
  id:string;
  name:string;
  publisher?:string;
  year?:number;
  url?:string;
  page?:string;
  license?:string;
};
export type SpellCatalog = {
  schemaVersion:1;
  system:SpellSystem;
  spells:SpellIdentity[];
  versions:SpellRulesVersion[];
  translations:SpellTranslation[];
  sources:SpellSource[];
};
export type SpellReference = {
  /** Personal character reference — no duplicated rule text. */
  spellId:string;
  versionId:string;
  acquiredFrom?:string;
  preparedRank?:number;
  prepared?:boolean;
  notes?:string;
};

export type SpellView = {
  id:string;
  system:SpellSystem;
  name:string;
  englishName:string;
  description:string;
  summary:string;
  locale:'ru'|'en';
  translated:boolean;
  translationStatus?:'verified'|'draft'|'missing';
  translationOrigin?:'at-your-service';
  spell:SpellIdentity;
  rules:SpellRulesVersion;
  source?:SpellSource;
};
export type SpellFilters = {
  query:string;
  kind:SpellKind|'all';
  rank:number|'all';
  tradition:PfTradition|'all';
  className:string;
  school:string;
  rarity:SpellRarity|'all';
  locale:'all'|'ru'|'en';
};
export const DEFAULT_SPELL_FILTERS:SpellFilters={
  query:'',kind:'all',rank:'all',tradition:'all',className:'all',
  school:'all',rarity:'all',locale:'all',
};
export const SPELL_SYSTEMS:Record<SpellSystem,{label:string;subtitle:string;editions:readonly string[];maxRank:number}>={
  pf2e:{label:'Pathfinder 2e',subtitle:'Remaster и Legacy',editions:['pf2e-remaster','pf2e-legacy'],maxRank:10},
  dnd5e:{label:'D&D 5e',subtitle:'2024 и 2014',editions:['dnd-2024','dnd-2014'],maxRank:9},
};
export const PF_TRADITIONS:Record<PfTradition,string>={
  arcane:'Мистическая',divine:'Сакральная',occult:'Оккультная',primal:'Первобытная',
};
export const SPELL_KIND_LABELS:Record<SpellKind,string>={
  cantrip:'Чары',spell:'Заклинания',focus:'Фокусные',ritual:'Ритуалы',special:'Особая магия',
};
export const RARITY_LABELS:Record<SpellRarity,string>={
  common:'Обычное',uncommon:'Необычное',rare:'Редкое',unique:'Уникальное',
};
export const DND_SCHOOLS:ReadonlyArray<{id:string;label:string}>=[
  {id:'abjuration',label:'Ограждение'},{id:'conjuration',label:'Вызов'},
  {id:'divination',label:'Прорицание'},{id:'enchantment',label:'Очарование'},
  {id:'evocation',label:'Воплощение'},{id:'illusion',label:'Иллюзия'},
  {id:'necromancy',label:'Некромантия'},{id:'transmutation',label:'Преобразование'},
];

export function emptySpellCatalog(system:SpellSystem):SpellCatalog {
  return {schemaVersion:1,system,spells:[],versions:[],translations:[],sources:[]};
}
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const isSystem=(v:unknown):v is SpellSystem=>v==='pf2e'||v==='dnd5e';
const isKind=(v:unknown):v is SpellKind=>Object.hasOwn(SPELL_KIND_LABELS,String(v));
/** Strictly reject incorrectly linked imports instead of silently losing spells. */
export function parseSpellCatalog(raw:unknown, expected:SpellSystem):SpellCatalog {
  if(!record(raw)||raw.schemaVersion!==1||!isSystem(raw.system)||raw.system!==expected)
    throw new Error('Неподдерживаемая версия или система каталога заклинаний.');
  if(!Array.isArray(raw.spells)||!Array.isArray(raw.versions)||!Array.isArray(raw.translations)||!Array.isArray(raw.sources))
    throw new Error('В каталоге отсутствует обязательный массив.');
  const catalog=raw as unknown as SpellCatalog;
  const ids=new Set<string>();
  const versionIds=new Set<string>();
  for(const spell of catalog.spells){
    if(!record(spell)||typeof spell.id!=='string'||!spell.id||ids.has(spell.id)||
       spell.system!==expected||!isKind(spell.kind)||
       !Number.isInteger(spell.rank)||spell.rank<0||spell.rank>SPELL_SYSTEMS[expected].maxRank||
       !Array.isArray(spell.traditions)||!Array.isArray(spell.classes)||!Array.isArray(spell.traits))
      throw new Error('Неверная или повторяющаяся запись заклинания.');
    ids.add(spell.id);
  }
  for(const version of catalog.versions){
    if(!record(version)||typeof version.id!=='string'||!version.id||versionIds.has(version.id)||
       typeof version.edition!=='string'||!ids.has(String(version.spellId)))
      throw new Error('Версия заклинания ссылается на неизвестную запись.');
    versionIds.add(version.id);
  }
  for(const translation of catalog.translations){
    if(!record(translation)||!ids.has(String(translation.spellId))||
      !versionIds.has(String(translation.versionId))||typeof translation.name!=='string'||
      (translation.locale!=='ru'&&translation.locale!=='en'))
      throw new Error('Некорректная локализация заклинания.');
  }
  return catalog;
}
export function toSpellViews(catalog:SpellCatalog,edition:string):SpellView[]{
  const sources=new Map(catalog.sources.map(source=>[source.id,source]));
  const versions=new Map(catalog.versions.filter(v=>v.edition===edition).map(v=>[v.spellId,v]));
  // Show legacy-only entries alongside the default Remaster collection, while
  // keeping their true rules revision unmistakable in the details. Never silently
  // re-label old rules as Remaster.
  if(edition==='pf2e-remaster'){
    for(const v of catalog.versions.filter(v=>v.edition==='pf2e-legacy')){
      if(!versions.has(v.spellId))versions.set(v.spellId,v);
    }
  }
  return catalog.spells.flatMap(spell=>{
    const rules=versions.get(spell.id);
    if(!rules)return [];
    const translations=catalog.translations.filter(t=>t.spellId===spell.id&&t.versionId===rules.id);
    const english=translations.find(t=>t.locale==='en');
    const russian=translations.find(t=>t.locale==='ru'&&t.translationStatus!=='missing');
    const selected=russian??english;
    return [{
      id:spell.id,system:spell.system,spell,rules,
      name:selected?.name||spell.slug,
      englishName:english?.name||spell.slug,
      summary:selected?.summary||'',description:selected?.description||'',
      locale:selected?.locale||'en',translated:Boolean(russian),translationStatus:selected?.translationStatus,
      translationOrigin:selected?.translationOrigin,
      source:sources.get(rules.sourceId??spell.sourceId),
    }];
  });
}
export function filterSpellViews(spells:readonly SpellView[],filters:SpellFilters):SpellView[]{
  const query=filters.query.trim().toLocaleLowerCase('ru');
  return spells.filter(item=>{
    const s=item.spell;
    if(filters.kind!=='all'&&s.kind!==filters.kind)return false;
    if(filters.rank!=='all'&&s.rank!==filters.rank)return false;
    if(filters.tradition!=='all'&&!s.traditions.includes(filters.tradition))return false;
    if(filters.className!=='all'&&!s.classes.includes(filters.className))return false;
    if(filters.school!=='all'&&s.school!==filters.school)return false;
    if(filters.rarity!=='all'&&s.rarity!==filters.rarity)return false;
    if(filters.locale==='ru'&&!item.translated)return false;
    if(filters.locale==='en'&&item.locale!=='en')return false;
    if(query&&!([item.name,item.englishName,item.summary,s.slug,...s.traits,
      ...s.classes,...s.classes.map(name=>name==='necromancer'?'Некромант':name)]
      .join(' ').toLocaleLowerCase('ru').includes(query)))return false;
    return true;
  }).sort((a,b)=>a.spell.rank-b.spell.rank||a.name.localeCompare(b.name,'ru'));
}
