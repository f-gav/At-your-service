import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_SPELL_FILTERS,DND_SCHOOLS,PF_TRADITIONS,SPELL_SYSTEMS,
  emptySpellCatalog,parseSpellCatalog,toSpellViews,filterSpellViews,
} from '../src/features/spell-library/catalog.ts';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');

for(const system of ['pf2e','dnd5e']){
  const fromDisk=JSON.parse(source(`../public/spell-library/${system}.json`));
  assert.deepEqual(parseSpellCatalog(fromDisk,system),emptySpellCatalog(system));
  assert.equal(toSpellViews(fromDisk,SPELL_SYSTEMS[system].editions[0]).length,0,
    'No spells are seeded during platform-only patch');
}
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
console.log('PASS: empty bilingual library catalogs, independent systems/revisions/translations, classification/filter model and UI integration');
