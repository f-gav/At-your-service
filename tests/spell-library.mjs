import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_SPELL_FILTERS,DND_SCHOOLS,PF_TRADITIONS,SPELL_SYSTEMS,
  emptySpellCatalog,parseSpellCatalog,toSpellViews,filterSpellViews,
} from '../src/features/spell-library/catalog.ts';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');

const dnd=JSON.parse(source('../public/spell-library/dnd5e.json'));
assert.deepEqual(parseSpellCatalog(dnd,'dnd5e'),emptySpellCatalog('dnd5e'),
  'D&D must remain untouched during Pathfinder waves 001–003');
const wave=JSON.parse(source('../public/spell-library/pf2e.json'));
parseSpellCatalog(wave,'pf2e');
assert.equal(wave.spells.length,282,'71 cantrips + 188 rank-one + 23 rank-two spells');
assert.equal(wave.versions.length,282);
assert.equal(wave.translations.filter(t=>t.locale==='ru').length,274,'259 initial + 15 rank-two Russian titles');
assert.equal(wave.translations.filter(t=>t.locale==='en').length,282,'Every spell retains a canonical English identity');
assert.ok(wave.spells.every(s=>s.system==='pf2e'&&((s.kind==='cantrip'&&s.rank===0)||(s.kind==='spell'&&(s.rank===1||s.rank===2)))));
assert.equal(wave.spells.filter(s=>s.kind==='cantrip').length,71);
assert.equal(wave.spells.filter(s=>s.kind==='spell'&&s.rank===1).length,188);
assert.equal(wave.spells.filter(s=>s.kind==='spell'&&s.rank===2).length,23);
assert.equal(wave.translations.filter(t=>t.locale==='en'&&wave.spells.find(s=>s.id===t.spellId)?.rank===2).length,23);
assert.equal(new Set(wave.spells.map(s=>s.id)).size,282,'Unique spell IDs');
assert.deepEqual(wave.spells.map(s=>s.slug).slice(0,3),['acid-splash','ancient-dust','approximate']);
assert.equal(wave.spells[23].slug,'glamorize');
assert.equal(wave.spells[24].slug,'glass-shield');
assert.equal(wave.spells[47].slug,'read-aura');
assert.equal(wave.spells[48].slug,'read-the-air');
assert.equal(wave.spells[70].slug,'wash-your-luck');
assert.equal(wave.spells[71].slug,'500-toads');
assert.equal(wave.spells[258].slug,'wooden-fists');
assert.equal(wave.spells.at(-1).slug,'blood-runs-cold');
assert.deepEqual(wave.spells.slice(239,259).map(s=>s.slug),[
  'swampcall','synchronize-steps','synchronize','tailwind','temporary-tool',
  'tether','thicket-of-knives','thoughtful-gift','threefold-limb','thunderstrike',
  'turnip-lantern','unbroken-panoply','vanishing-tracks','ventriloquism','verdant-sprout',
  'verminous-lure','wall-of-shrubs','weaken-earth','weave-wood','wooden-fists'
], 'Exact final 20 rank-one source order');
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-turnip-lantern')?.duration,'1 минута',
  'Turnip Lantern duration must not be mistaken for a target');
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-turnip-lantern')?.targets,undefined);
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-temporary-tool')?.cast?.time,'1 минута');
assert.equal(wave.versions.find(v=>v.spellId==='pf2e-thunderstrike')?.cast?.actions,2);

const englishOnly=[
  "ancient-dust",
  "approximate",
  "artistic-recollection",
  "bramble-bush",
  "caustic-blast",
  "create-earthen-facsimile",
  "frosts-touch",
  "ghost-sound",
  "glamorize",
  "glass-shield",
  "glowing-trail",
  "illuminate",
  "infectious-enthusiasm",
  "inside-ropes",
  "invoke-true-name",
  "join-pasts",
  "know-the-way",
  "live-wire",
  "musical-accompaniment",
  "root-reading",
  "take-root",
  "timber",
  "torturous-trauma",
  "500-toads",
  "admonishing-ray",
  "airburst",
  "aqueous-blast",
  "armor-of-thorn-and-claw",
  "benediction",
  "beseech-the-sphinx",
  "blessing-of-vigor",
  "bone-shield",
  "breathe-fire",
  "briny-bolt",
  "buffeting-winds",
  "buoyant-bubbles",
  "camel-spit",
  "carryall",
  "celestial-accord",
  "chilling-spray",
  "cinder-scribe",
  "cleanse-cuisine",
  "concordant-choir",
  "conductive-weapon",
  "connective-current",
  "cradle-aloft",
  "curse-of-recoil",
  "curse-of-slippery-steps",
  "cycle-of-retribution",
  "decompose",
  "defended-by-spirits",
  "dehydrate",
  "devils-horseshoe",
  "disguise-magic",
  "dome-of-tranquility",
  "draw-ire",
  "déjà-vu",
  "echoing-weapon",
  "elysian-whimsy",
  "equal-footing",
  "exchange-image",
  "fashionista",
  "fated-healing",
  "fishing-spot",
  "flashy-disappearance",
  "flense",
  "flourishing-flora",
  "foraging-friends",
  "forced-mercy",
  "forge",
  "friendfetch",
  "gentle-landing",
  "gloom-mantle",
  "gravitational-pull",
  "gritty-wheeze",
  "groom-companion",
  "helpful-steps",
  "hippocampus-retreat",
  "imprint-message",
  "infuse-vitality",
  "inkshot",
  "instant-pottery",
  "interposing-earth",
  "invisible-item",
  "juvenile-companion",
  "kinetic-ram",
  "know-location",
  "leaden-steps",
  "malediction",
  "message-rune",
  "metal-merged",
  "mystic-armor",
  "negate-aroma",
  "nettleskin",
  "noxious-vapors",
  "object-reading",
  "overselling-flourish",
  "penumbral-shroud",
  "personal-rain-cloud",
  "pest-form",
  "pet-cache",
  "phantasmal-minion",
  "propelling-air-stream",
  "protector-tree",
  "pummeling-rubble",
  "purifying-icicle",
  "putrefy-food-and-drink",
  "rainbows-end",
  "reed-whistle",
  "rude-awakening",
  "runic-body",
  "runic-weapon",
  "sacred-beasts",
  "scorching-blast",
  "scouring-sand",
  "seashell-of-stolen-sound",
  "shielded-arm",
  "signal-skyrocket",
  "sky-sight",
  "spirit-ward",
  "stick-on",
  "summon-lesser-servitor",
  "summon-undead",
  "synchronize-steps",
  "tailwind",
  "threefold-limb",
  "turnip-lantern",
  "unbroken-panoply",
  "vanishing-tracks",
  "verdant-sprout",
  "verminous-lure",
  "weaken-earth",
  "weave-wood",
  "wooden-fists"
];
for(const slug of englishOnly){
  const id='pf2e-'+slug;
  assert.ok(wave.translations.some(t=>t.spellId===id&&t.locale==='en'),
    'Original English identity must always be preserved: '+slug);
}
for(const t of wave.translations){
  if(t.locale==='ru'||englishOnly.some(slug=>t.spellId==='pf2e-'+slug))
    assert.ok(t.description?.length>50,'No empty spell descriptions: '+t.spellId);
}
const liveViews=toSpellViews(wave,'pf2e-remaster');
assert.equal(liveViews.length,282,'All 259 initial and 23 rank-two spells are searchable');
assert.equal(liveViews.filter(v=>v.locale==='ru').length,274);
assert.equal(liveViews.filter(v=>v.locale==='en').length,8);
const legacy=liveViews.filter(v=>v.rules.edition==='pf2e-legacy');
assert.deepEqual(legacy.filter(v=>v.spell.rank<=1).map(v=>v.spell.slug).sort(),["acid-splash","admonishing-ray","airburst","ancient-dust","animate-rope","aqueous-blast","buffeting-winds","celestial-accord","draw-ire","elysian-whimsy","exchange-image","fashionista","flashy-disappearance","flense","forge","friendfetch","ghost-sound","glowing-trail","gritty-wheeze","healing-plaster","helpful-steps","inkshot","inside-ropes","invoke-true-name","join-pasts","know-location","magic-stone","negate-aroma","nettleskin","overselling-flourish","personal-rain-cloud","purifying-icicle","putrefy-food-and-drink","ray-of-frost","scorching-blast","scouring-sand","shillelagh","shocking-grasp","snowball","swampcall","synchronize-steps","torturous-trauma","verdant-sprout","verminous-lure"]);
assert.equal(toSpellViews(wave,'pf2e-legacy').filter(v=>v.spell.rank<=1).length,44);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length===274);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'en'}).length===8);
assert.ok(liveViews.every(v=>wave.sources.some(src=>src.id===v.spell.sourceId)));
const electric=liveViews.find(v=>v.spell.slug==='electric-arc');
assert.ok(electric?.description.includes('2d4'),'Remaster electric arc has 2d4 base damage');
assert.ok(!electric?.description.includes('1d4 +'),'Legacy mechanics must not leak into Remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='elemental-counter')?.rules.resource,'spell-slot');
assert.equal(englishOnly.length,134,'Historical pre-translation English-only list contains 134 entries');
const tracker=source('../docs/SPELL-ENGLISH-TRACKER-RU.md');
const trackedNames=[...tracker.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map(m=>m[1]).sort();
const actualEnglishNames=liveViews.filter(v=>v.locale==='en'&&v.spell.rank<=1).map(v=>v.englishName).sort();
const rankTwoTracker=source('../docs/SPELL-RANK2-ENGLISH-TRACKER-RU.md');
for(const v of liveViews.filter(v=>v.locale==='en'&&v.spell.rank===2)) assert.ok(rankTwoTracker.includes('| '+v.englishName+' |'),'Rank-two English backlog must include '+v.englishName);
assert.deepEqual(trackedNames,actualEnglishNames,
  'Live English-only tracker must exactly match untranslated site cards');
const manifest=source('../docs/SPELL-WAVE-002-RU.md');
assert.ok(manifest.includes('14 с подтверждённым русским названием'));
assert.ok(manifest.includes('10 с английскими названиями'));

assert.equal(englishOnly.filter(slug=>{const i=wave.spells.findIndex(s=>s.slug===slug);return i>=24&&i<48;}).length,10,
 'Wave 002 adds ten English-only cantrips');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=24&&wave.spells.findIndex(s=>s.id===t.spellId)<48).length,24);
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=48&&wave.spells.findIndex(s=>s.id===t.spellId)<71).length,23,'Every cantrip is now translated');
assert.equal(englishOnly.filter(slug=>{const n=wave.spells.findIndex(s=>s.slug===slug);return n>=48&&n<71;}).length,4,'Cantrip Wave 003 has four English-only entries');
assert.equal(liveViews.find(v=>v.spell.slug==='summon-instrument')?.rules.cast.actions,3);
assert.ok(liveViews.find(v=>v.spell.slug==='shield')?.description.includes('Твёрдостью 5'));
assert.ok(liveViews.find(v=>v.spell.slug==='slashing-gust')?.rules.requirements?.includes('рука'));
assert.equal(liveViews.find(v=>v.spell.slug==='torturous-trauma')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='void-warp')?.description.includes('2d4'));
assert.ok(liveViews.find(v=>v.spell.slug==='vitality-lash')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='root-reading')?.locale==='ru');
assert.ok(liveViews.find(v=>v.spell.slug==='wash-your-luck')?.locale==='ru');
assert.ok(source('../docs/SPELL-WAVE-003-RU.md').includes('19 русских'));
assert.equal(englishOnly.filter(slug=>wave.spells.findIndex(s=>s.slug===slug)>=71).length,111,
  'Four rank-one waves contain 61 English-only cards');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=71&&wave.spells.findIndex(s=>s.id===t.spellId)<259).length,188);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:0}).length,71);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:1}).length,188);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:2}).length,23);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,kind:'spell'}).length,211);
assert.ok(liveViews.filter(v=>v.spell.rank===1).every(v=>v.rules.resource==='spell-slot'),
  'All first-rank spells spend a slot, cantrips remain cost-free');
assert.equal(liveViews.find(v=>v.spell.slug==='air-bubble')?.rules.cast?.time,'Реакция');
assert.ok(liveViews.find(v=>v.spell.slug==='air-bubble')?.rules.trigger?.includes('дышать'));
assert.equal(liveViews.find(v=>v.spell.slug==='alarm')?.rules.cast?.time,'10 минут');
assert.equal(liveViews.find(v=>v.spell.slug==='breadcrumbs')?.rules.cast?.time,'1 минута');
assert.equal(liveViews.find(v=>v.spell.slug==='bane')?.rules.edition,'pf2e-remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='admonishing-ray')?.rules.edition,'pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='500-toads')?.spell.rarity,'rare');
assert.ok(liveViews.find(v=>v.spell.slug==='bone-shield')?.rules.requirements?.includes('рука'));
assert.ok(liveViews.find(v=>v.spell.slug==='breathe-fire')?.description.includes('урон огнём'));
assert.ok(source('../docs/SPELL-RANK1-WAVE-001-RU.md').includes('13 карточек с русскими названиями'));


assert.equal(liveViews.find(v=>v.spell.slug==='gouging-claw')?.rules.edition,'pf2e-remaster');
assert.ok(liveViews.find(v=>v.spell.slug==='gouging-claw')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='live-wire')?.description.includes('электрический'));
assert.ok(liveViews.find(v=>v.spell.slug==='ray-of-frost')?.rules.edition==='pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='read-aura')?.rules.cast?.time,'1 минута');
assert.ok(liveViews.every(v=>v.description.length>50),'Every card retains an original or independent Russian rules summary');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&t.translatorCredit?.includes('PF2.ru, найдено через модуль')).length,77);
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&t.translatorCredit?.includes('Pathfinder 2E RU Translation (Legacy')).length,1);
assert.ok(liveViews.find(v=>v.spell.slug==='mystic-armor')?.name==='Магический доспех');
assert.ok(liveViews.find(v=>v.spell.slug==='invoke-true-name')?.name==='Призыв истинного имени');
assert.ok(liveViews.find(v=>v.spell.slug==='ancient-dust')?.locale==='ru');
const briny=liveViews.find(v=>v.spell.slug==='briny-bolt');
assert.equal(briny?.name,'Солёный снаряд');
assert.equal(briny?.englishName,'Briny Bolt');
assert.equal(briny?.locale,'ru');
assert.equal(briny?.rules.edition,'pf2e-remaster');
assert.equal(briny?.translationOrigin,'at-your-service');
assert.ok(briny?.description.includes('Совершите дистанционную атаку заклинанием'));
assert.ok(briny?.rules.outcomes?.criticalSuccess?.includes('растерянность на 1 минуту'));
assert.ok(briny?.rules.outcomes?.success?.includes('слепоту на 1 раунд'));
assert.ok(briny?.rules.outcomes?.criticalSuccess?.includes('но не от растерянности'));
assert.equal(briny?.rules.heightened?.['+1'],'Урон увеличивается на 2d6.');
assert.equal(liveViews.filter(v=>v.translationOrigin==='at-your-service').length,56,
  'All 56 independently translated cards must retain first-party attribution');
const wave1Names={
  'ancient-dust':'Древний прах',
  'artistic-recollection':'Художественное воспоминание',
  'bramble-bush':'Колючий куст',
  'create-earthen-facsimile':'Создание земляного подобия',
  'glowing-trail':'Светящийся след',
  'inside-ropes':'Верёвка из внутренностей',
  'join-pasts':'Связь воспоминаний',
  'musical-accompaniment':'Музыкальное сопровождение',
  'torturous-trauma':'Мучительная травма',
};
for(const [slug,name] of Object.entries(wave1Names)){
  const entry=liveViews.find(v=>v.spell.slug===slug);
  assert.equal(entry?.name,name,'Authored Russian spell title: '+slug);
  assert.equal(entry?.locale,'ru','Wave 1 must no longer fall back to English: '+slug);
  assert.equal(entry?.translationOrigin,'at-your-service','Every original translation is credited: '+slug);
  assert.ok(entry?.description.length>150,'Translate full mechanical text, not a placeholder: '+slug);
}

const firstCycle=[
  ['admonishing-ray','Вразумляющий луч','pf2e-legacy'],
  ['airburst','Воздушный выброс','pf2e-legacy'],
  ['blessing-of-vigor','Благословение жизненных сил','pf2e-remaster'],
  ['bone-shield','Костяной щит','pf2e-remaster'],
  ['buffeting-winds','Шквальные ветры','pf2e-legacy'],
  ['celestial-accord','Небесное согласие','pf2e-legacy'],
  ['cinder-scribe','Пепельный писец','pf2e-remaster'],
  ['connective-current','Связующий поток','pf2e-remaster'],
  ['cradle-aloft','Парящая колыбель','pf2e-remaster'],
  ['curse-of-slippery-steps','Проклятие скользких шагов','pf2e-remaster'],
  ['cycle-of-retribution','Круг возмездия','pf2e-remaster'],
  ['decompose','Разложение','pf2e-remaster'],
  ['defended-by-spirits','Под защитой духов','pf2e-remaster'],
  ['devils-horseshoe','Дьявольская подкова','pf2e-remaster'],
  ['dome-of-tranquility','Купол безмятежности','pf2e-remaster'],
  ['elysian-whimsy','Причуда Элизиума','pf2e-legacy'],
];
assert.equal(firstCycle.length,16);
for(const [slug,russian,edition] of firstCycle){
  const view=liveViews.find(v=>v.spell.slug===slug);
  assert.ok(view,'Translated spell must exist: '+slug);
  assert.equal(view.name,russian,'Russian spell title: '+slug);
  assert.equal(view.locale,'ru','Russian card locale: '+slug);
  assert.equal(view.rules.edition,edition,'Legacy/Remaster source must be preserved: '+slug);
  assert.equal(view.translationOrigin,'at-your-service','Every self-authored spell has its AYS label: '+slug);
  assert.ok(view.englishName.length>3&&view.englishName!==view.name,'English original must remain searchable: '+slug);
  assert.ok(view.description.length>50,'Full spell description missing: '+slug);
  const entry=wave.translations.find(t=>t.spellId===view.id&&t.locale==='ru');
  assert.ok(entry?.translatorCredit?.includes('Перевод от At your service!'),
    'Self-authored credits must be retained: '+slug);
  assert.ok(!/\b(?:Critical Success|Critical Failure|Heightened|Sustain)\b/.test(view.description),
    'English mechanic remains in authored Russian card: '+slug);
}
const firstCycleBySlug=slug=>liveViews.find(v=>v.spell.slug===slug);
assert.equal(firstCycleBySlug('bone-shield')?.rules.heightened?.['+2'],'Твёрдость щита увеличивается на 3.');
assert.ok(firstCycleBySlug('buffeting-winds')?.description.includes('2d4 дробящего урона'));
assert.ok(!firstCycleBySlug('buffeting-winds')?.description.includes('сбивает с ног живых'),
  'Buffeting Winds must not falsely impose prone');
assert.ok(firstCycleBySlug('celestial-accord')?.description.includes('подвергается враждебности'));
assert.equal(firstCycleBySlug('cycle-of-retribution')?.rules.sustain,true);
assert.equal(firstCycleBySlug('cycle-of-retribution')?.rules.duration,'Поддерживаемое, до 1 минуты');
assert.equal(firstCycleBySlug('defended-by-spirits')?.rules.sustain,true);
assert.equal(firstCycleBySlug('defended-by-spirits')?.rules.duration,'Поддерживаемое, до 1 минуты');
assert.ok(firstCycleBySlug('devils-horseshoe')?.rules.outcomes?.failure?.includes('Бестия'));
assert.ok(!firstCycleBySlug('devils-horseshoe')?.description.includes('Когда бес проходит'),
  'Fiend must not be narrowed to an imp');
assert.ok(firstCycleBySlug('elysian-whimsy')?.description.includes('4 — Неожиданная щедрость'));
assert.ok(firstCycleBySlug('cinder-scribe')?.rules.heightened?.['4']?.includes('неограниченной'));
assert.equal(firstCycleBySlug('airburst')?.rules.heightened?.['4']?.includes('10 футов'),true);
assert.equal(firstCycleBySlug('cradle-aloft')?.rules.cast?.actions,1);
assert.equal(liveViews.filter(v=>v.spell.kind==='cantrip'&&v.locale==='en').length,0,
  'All 71 cantrips must be available in Russian');
assert.ok(liveViews.find(v=>v.spell.slug==='ancient-dust')?.rules.outcomes?.criticalFailure?.includes('двойной'));
assert.equal(liveViews.find(v=>v.spell.slug==='ancient-dust')?.rules.heightened?.['+2'],
  'Начальный урон пустотой увеличивается на 1d6, а продолжительный урон — на 1.');
assert.ok(liveViews.find(v=>v.spell.slug==='bramble-bush')?.description.includes('опасной местностью'));
assert.ok(liveViews.find(v=>v.spell.slug==='bramble-bush')?.rules.heightened?.['+2']?.includes('1d4'));
assert.ok(liveViews.find(v=>v.spell.slug==='inside-ropes')?.description.includes('чистую проверку со СЛ 5'));
assert.ok(liveViews.find(v=>v.spell.slug==='glowing-trail')?.description.includes('10 минут'));
assert.ok(liveViews.find(v=>v.spell.slug==='musical-accompaniment')?.description.includes('штраф −4'));
assert.ok(liveViews.find(v=>v.spell.slug==='torturous-trauma')?.description.includes('внутренних органов'));

assert.ok(liveViews.every(v=>Boolean(v.source?.name)),'Each spell has a credited source book');
assert.equal(SPELL_SYSTEMS.pf2e.maxRank,10);
assert.equal(SPELL_SYSTEMS.dnd5e.maxRank,9);
assert.equal(Object.keys(PF_TRADITIONS).length,4);
assert.equal(DND_SCHOOLS.length,8);
assert.throws(()=>parseSpellCatalog(emptySpellCatalog('pf2e'),'dnd5e'),/система каталога/);
assert.throws(()=>parseSpellCatalog({schemaVersion:1,system:'pf2e',spells:[],versions:[],translations:[]},'pf2e'),/массив/);

const catalog=emptySpellCatalog('pf2e');
catalog.sources.push({id:'core',name:'Player Core'});
catalog.spells.push({
  id:'pf2e-example',system:'pf2e',slug:'example-spell',kind:'cantrip',rank:0,
  traditions:['arcane','occult'],classes:[],traits:['mental'],rarity:'common',sourceId:'core',
});
catalog.versions.push({id:'remaster-example',spellId:'pf2e-example',edition:'pf2e-remaster',cast:{actions:2}});
catalog.translations.push(
  {spellId:'pf2e-example',versionId:'remaster-example',locale:'en',name:'Example Spell'},
  {spellId:'pf2e-example',versionId:'remaster-example',locale:'ru',name:'Пробное заклинание'},
);
const views=toSpellViews(parseSpellCatalog(catalog,'pf2e'),'pf2e-remaster');
assert.equal(views.length,1);
assert.equal(views[0].name,'Пробное заклинание');
assert.equal(views[0].translated,true);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,tradition:'arcane'}).length,1);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,tradition:'primal'}).length,0);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,query:'example spell'}).length,1);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,rank:1}).length,0);
assert.equal(filterSpellViews(views,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length,1);
assert.equal(toSpellViews(catalog,'pf2e-legacy').length,0);

const app=source('../src/App.tsx');
const page=source('../src/features/spell-library/SpellLibrary.tsx');
assert.ok(app.includes('Персонажи</button>')&&app.includes('Библиотека</button>'));
assert.ok(app.includes("<SpellLibrary onBack="));
assert.ok(app.includes("parseSiteRoute(window.location.hash)") && app.includes("siteRouteHash({kind:tab})"),'Library supports direct hash links');
assert.ok(page.includes('spell-library/pf2e')===false,'System catalogs use independent dynamic paths');
assert.ok(page.includes('parseSpellCatalog(await response.json(),system)'));
assert.ok(page.includes('section===\'mine\''));
assert.ok(page.includes('rules.ritual===true'),'D&D ritual flag remains distinct');
assert.ok(page.includes('setSelectedId(spell.id)'),'Spell details work after later import');
console.log('PASS: PF2e 71 cantrips + 188 rank-one + 23 rank-two spells (274 RU/8 EN), tracker, Legacy, D&D untouched');
