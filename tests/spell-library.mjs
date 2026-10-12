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
assert.equal(wave.spells.length,71,'All three waves contain exactly 71 cantrips');
assert.equal(wave.versions.length,71);
assert.equal(wave.translations.filter(t=>t.locale==='ru').length,48,'15 + 14 + 19 Russian entries');
assert.equal(wave.translations.filter(t=>t.locale==='en').length,71,'Every spell retains an English identity');
assert.ok(wave.spells.every(s=>s.kind==='cantrip'&&s.rank===0&&s.system==='pf2e'));
assert.equal(new Set(wave.spells.map(s=>s.id)).size,71,'Unique spell IDs');
assert.deepEqual(wave.spells.map(s=>s.slug).slice(0,3),['acid-splash','ancient-dust','approximate']);
assert.equal(wave.spells[23].slug,'glamorize');
assert.equal(wave.spells[24].slug,'glass-shield');
assert.equal(wave.spells[47].slug,'read-aura');
assert.equal(wave.spells[48].slug,'read-the-air');
assert.equal(wave.spells.at(-1).slug,'wash-your-luck');
const englishOnly=['ancient-dust','approximate','artistic-recollection','bramble-bush',
  'caustic-blast','create-earthen-facsimile','frosts-touch','ghost-sound','glamorize',
  'glass-shield','glowing-trail','illuminate','infectious-enthusiasm',
  'inside-ropes','invoke-true-name','join-pasts','know-the-way','live-wire','musical-accompaniment',
  'root-reading','take-root','timber','torturous-trauma'];
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
assert.equal(liveViews.length,71,'Every source cantrip appears, with Legacy explicitly marked');
assert.equal(liveViews.filter(v=>v.locale==='ru').length,48);
assert.equal(liveViews.filter(v=>v.locale==='en').length,23);
const legacy=liveViews.filter(v=>v.rules.edition==='pf2e-legacy');
assert.deepEqual(legacy.map(v=>v.spell.slug).sort(),[
 'acid-splash','ancient-dust','ghost-sound','glowing-trail','healing-plaster',
 'inside-ropes','invoke-true-name','join-pasts','ray-of-frost','torturous-trauma'].sort());
assert.equal(toSpellViews(wave,'pf2e-legacy').length,10);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'ru'}).length===48);
assert.ok(filterSpellViews(liveViews,{...DEFAULT_SPELL_FILTERS,locale:'en'}).length===23);
assert.ok(liveViews.every(v=>wave.sources.some(src=>src.id===v.spell.sourceId)));
const electric=liveViews.find(v=>v.spell.slug==='electric-arc');
assert.ok(electric?.description.includes('2d4'),'Remaster electric arc has 2d4 base damage');
assert.ok(!electric?.description.includes('1d4 +'),'Legacy mechanics must not leak into Remaster');
assert.equal(liveViews.find(v=>v.spell.slug==='elemental-counter')?.rules.resource,'spell-slot');
assert.equal(englishOnly.length,23,'Cumulative English-only ledger across all three waves');
const tracker=source('../docs/SPELL-ENGLISH-TRACKER-RU.md');
const trackedNames=[...tracker.matchAll(/^\d+\. \*\*([^*]+)\*\*/gm)].map(m=>m[1]).sort();
const actualEnglishNames=liveViews.filter(v=>v.locale==='en').map(v=>v.englishName).sort();
assert.deepEqual(trackedNames,actualEnglishNames,
  'Cumulative English-only tracker must exactly match untranslated site cards');
const manifest=source('../docs/SPELL-WAVE-002-RU.md');
assert.ok(manifest.includes('14 с подтверждённым русским названием'));
assert.ok(manifest.includes('10 с английскими названиями'));

assert.equal(englishOnly.filter(slug=>wave.spells.findIndex(s=>s.slug===slug)>=24).length,10,
 'Wave 002 adds ten English-only cantrips');
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=24&&wave.spells.findIndex(s=>s.id===t.spellId)<48).length,14);
assert.equal(wave.translations.filter(t=>t.locale==='ru'&&wave.spells.findIndex(s=>s.id===t.spellId)>=48).length,19,'Wave 003 has 19 Russian entries');
assert.equal(englishOnly.filter(slug=>wave.spells.findIndex(s=>s.slug===slug)>=48).length,4,'Wave 003 has 4 English-only entries');
assert.equal(liveViews.find(v=>v.spell.slug==='summon-instrument')?.rules.cast.actions,3);
assert.ok(liveViews.find(v=>v.spell.slug==='shield')?.description.includes('Твёрдостью 5'));
assert.ok(liveViews.find(v=>v.spell.slug==='slashing-gust')?.rules.requirements?.includes('рука'));
assert.equal(liveViews.find(v=>v.spell.slug==='torturous-trauma')?.rules.edition,'pf2e-legacy');
assert.ok(liveViews.find(v=>v.spell.slug==='void-warp')?.description.includes('2d4'));
assert.ok(liveViews.find(v=>v.spell.slug==='vitality-lash')?.description.includes('2d6'));
assert.ok(liveViews.find(v=>v.spell.slug==='root-reading')?.locale==='en');
assert.ok(liveViews.find(v=>v.spell.slug==='wash-your-luck')?.locale==='ru');
assert.ok(source('../docs/SPELL-WAVE-003-RU.md').includes('19 русских'));

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
console.log('PASS: all three PF2e cantrip waves (71 cantrips, 48 Russian, 23 English), tracker, Legacy, D&D untouched');
