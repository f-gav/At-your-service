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
assert.equal(wave.spells.length,191,'71 cantrips + 120 rank-one spells');
assert.equal(wave.versions.length,191);
assert.equal(wave.translations.filter(t=>t.locale==='ru').length,93,'48 cantrips + 45 rank-one Russian cards');
assert.equal(wave.translations.filter(t=>t.locale==='en').length,191,'Every spell retains a canonical English identity');
assert.ok(wave.spells.every(s=>s.system==='pf2e'&&((s.kind==='cantrip'&&s.rank===0)||(s.kind==='spell'&&s.rank===1))));
assert.equal(wave.spells.filter(s=>s.kind==='cantrip').length,71);
assert.equal(wave.spells.filter(s=>s.kind==='spell'&&s.rank===1).length,120);
assert.equal(new Set(wave.spells.map(s=>s.id)).size,191,'Unique spell IDs');
assert.deepEqual(wave.spells.map(s=>s.slug).slice(0,3),['acid-splash','ancient-dust','approximate']);
assert.equal(wave.spells[23].slug,'glamorize');
assert.equal(wave.spells[24].slug,'glass-shield');
assert.equal(wave.spells[47].slug,'read-aura');
assert.equal(wave.spells[48].slug,'read-the-air');
assert.equal(wave.spells[70].slug,'wash-your-luck');
assert.equal(wave.spells[71].slug,'500-toads');
assert.equal(wave.spells.at(-1).slug,'overselling-flourish');
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
  "nudge-the-odds",
  "object-reading",
  "overselling-flourish"
];
for(const slug of englishOnly){
  const id='pf2e-'+slug;
  assert.ok(!wave.translations.some(t=>t.spellId===id&&t.locale==='ru'),
    'Missing Russian translation must never be fabricated: '+slug);
}
for(const t of wave.translations){
  if(t.locale==='ru'||englishOnly.some(slug=>t.spellId==='pf2e-'+slug))
    assert.ok(t.description?.length>50,'No empty spell descriptions: '+t.spellId);
}
const liveViews=toSpellViews(wave,'pf2e-remaster');
assert.equal(liveViews.length,191,'All 71 cantrips and 120 rank-one spells are searchable');
assert.equal(liveViews.filter(v=>v.locale==='ru').length,93);
assert.equal(liveViews.filter(v=>v.locale==='en').length,98);
const legacy=liveViews.filter(v=>v.rules.edition==='pf2e-legacy');
assert.deepEqual(legacy.map(v=>v.spell.slug).sort(),["acid-splash","admonishing-ray","airburst","ancient-dust","animate-rope","aqueous-blast","buffeting-winds","celestial-accord","draw-ire","elysian-whimsy","exchange-image","fashionista","flashy-disappearance","flense","forge","friendfetch","ghost-sound","glowing-trail","gritty-wheeze","healing-plaster","helpful-steps","inkshot","inside-ropes","invoke-true-name","join-pasts","know-location","magic-stone","negate-aroma","nettleskin","overselling-flourish","ray-of-frost","torturous-trauma"]);
assert.equal(toSpellViews(wave,'pf2e-legacy').length,32);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length===93);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'en'}).length===98);
assert.ok(liveViews.every(v=>wave.sources.some(src=>src.id===v.spell.sourceId)));
const electric=liveViews.find(v=>v.spell.slug==='electric-arc');
assert.ok(electric?.description.includes('2d4'),'Remaster electric arc has 2d4 base damage');
assert.ok(!electric?.description.includes('1d4 +'),'Legacy mechanics must not leak into Remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='elemental-counter')?.rules.resource,'spell-slot');
assert.equal(englishOnly.length,98,'Cumulative English-only ledger includes rank-one wave 001');
const tracker=source('../docs/SPELL-ENGLISH-TRACKER-RU.md');
const trackedNames=[...tracker.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map(m=>m[1]).sort();
const actualEnglishNames=liveViews.filter(v=>v.locale==='en').map(v=>v.englishName).sort();
assert.deepEqual(trackedNames,actualEnglishNames,
  'Cumulative English-only tracker must exactly match untranslated site cards');
const manifest=source('../docs/SPELL-WAVE-002-RU.md');
assert.ok(manifest.includes('14 с подтверждённым русским названием'));
assert.ok(manifest.includes('10 с английскими названиями'));

assert.equal(englishOnly.filter(slug=>{const i=wave.spells.findIndex(s=>s.slug===slug);return i>=24&&i<48;}).length,10,
 'Wave 002 adds ten English-only cantrips');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=24&&wave.spells.findIndex(s=>s.id===t.spellId)<48).length,14);
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=48&&wave.spells.findIndex(s=>s.id===t.spellId)<71).length,19,'Cantrip wave 003 has 19 Russian entries');
assert.equal(englishOnly.filter(slug=>{const n=wave.spells.findIndex(s=>s.slug===slug);return n>=48&&n<71;}).length,4,'Cantrip Wave 003 has four English-only entries');
assert.equal(liveViews.find(v=>v.spell.slug==='summon-instrument')?.rules.cast.actions,3);
assert.ok(liveViews.find(v=>v.spell.slug==='shield')?.description.includes('Твёрдостью 5'));
assert.ok(liveViews.find(v=>v.spell.slug==='slashing-gust')?.rules.requirements?.includes('рука'));
assert.equal(liveViews.find(v=>v.spell.slug==='torturous-trauma')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='void-warp')?.description.includes('2d4'));
assert.ok(liveViews.find(v=>v.spell.slug==='vitality-lash')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='root-reading')?.locale==='en');
assert.ok(liveViews.find(v=>v.spell.slug==='wash-your-luck')?.locale==='ru');
assert.ok(source('../docs/SPELL-WAVE-003-RU.md').includes('19 русских'));
assert.equal(englishOnly.filter(slug=>wave.spells.findIndex(s=>s.slug===slug)>=71).length,75,
  'Four rank-one waves contain 61 English-only cards');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=71).length,45);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:0}).length,71);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,rank:1}).length,120);
assert.equal(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,kind:'spell'}).length,120);
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
assert.ok(liveViews.find(v=>v.spell.slug==='breathe-fire')?.description.includes('2d6'));
assert.ok(source('../docs/SPELL-RANK1-WAVE-001-RU.md').includes('13 карточек с русскими названиями'));


assert.equal(liveViews.find(v=>v.spell.slug==='gouging-claw')?.rules.edition,'pf2e-remaster');
assert.ok(liveViews.find(v=>v.spell.slug==='gouging-claw')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='live-wire')?.description.includes('failure'));
assert.ok(liveViews.find(v=>v.spell.slug==='ray-of-frost')?.rules.edition==='pf2e-legacy');
assert.equal(liveViews.find(v=>v.spell.slug==='read-aura')?.rules.cast?.time,'1 minute');
assert.ok(liveViews.every(v=>v.description.length>50),'Every card has its own rules description');
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
assert.ok(app.includes("window.location.hash==='#library'"),'Library supports direct hash links');
assert.ok(page.includes('spell-library/pf2e')===false,'System catalogs use independent dynamic paths');
assert.ok(page.includes('parseSpellCatalog(await response.json(),system)'));
assert.ok(page.includes('section===\'mine\''));
assert.ok(page.includes('rules.ritual===true'),'D&D ritual flag remains distinct');
assert.ok(page.includes('setSelectedId(spell.id)'),'Spell details work after later import');
console.log('PASS: PF2e 71 cantrips + 120 rank-one spells (93 RU/98 EN), tracker, Legacy, D&D untouched');
