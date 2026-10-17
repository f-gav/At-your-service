import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 PF_SPELL_LAYOUT,readSpellLayout,resolveSpellLayout,automaticSpellZone,
 moveSpellLayout,addSpellDivider,setSpellDividerTitle,deleteSpellDivider,
 spellZoneRows,spellClassicFieldZone,
} from '../src/features/pathfinder/spell-layout.ts';
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';

const spell=(id,kind,rank=1)=>({id,name:id,spell:{id,kind,rank}});
const base=[
 spell('ordinary-cantrip','cantrip',0),spell('create-thrall','cantrip',1),
 spell('bone-spear','focus',1),spell('magic-missile','spell',1),
 spell('healing','spell',1),spell('summon','spell',2),
 spell('innate-blessing','special',1),
 spell('ritual-a','ritual',1),spell('ritual-b','ritual',2),
];
const original=JSON.stringify(base);
const rows=resolveSpellLayout(base,'');
assert.deepEqual(rows.map(row=>row.zone),[
 'cantrip','cantrip','focus','spellbook-left','spellbook-right','spellbook-left',
 'innate','rituals-left','rituals-right',
],'Original spell kinds select their sheet tables automatically, even rank-one cantrips');
assert.equal(spellClassicFieldZone('spellbook_left_names'),'spellbook-left');
assert.equal(spellClassicFieldZone('spellbook_right_actions'),'spellbook-right');
assert.equal(spellClassicFieldZone('cantrip_names'),'cantrip');
assert.equal(spellClassicFieldZone('focus_spells'),'focus');
assert.equal(spellClassicFieldZone('innate_actions'),'innate');
assert.equal(spellClassicFieldZone('rituals_right_name'),'rituals-right');
assert.equal(spellClassicFieldZone('unknown'),null);
assert.equal(automaticSpellZone(spell('test','cantrip',1),[]),'cantrip');

let persisted=moveSpellLayout(base,'','bone-spear','spellbook-right','healing');
let moved=resolveSpellLayout(base,persisted);
assert.deepEqual(spellZoneRows(moved,'spellbook-right').map(row=>row.id),['bone-spear','healing']);
assert.equal(base[2].spell.kind,'focus','Manual visual positioning must not rewrite class mechanics');
assert.equal(JSON.stringify(base),original,'Source spells are immutable');
assert.equal(moveSpellLayout(base,persisted,'bone-spear','spellbook-right','bone-spear'),persisted,
  'Dropping on the original row does not unexpectedly move it to the bottom');

persisted=moveSpellLayout(base,persisted,'healing','spellbook-right','bone-spear');
assert.deepEqual(spellZoneRows(resolveSpellLayout(base,persisted),'spellbook-right').map(row=>row.id),
  ['healing','bone-spear'],'Reordering within one field is retained');

persisted=addSpellDivider(base,persisted,'cantrip','divider:alpha','create-thrall');
let arranged=resolveSpellLayout(base,persisted);
assert.deepEqual(spellZoneRows(arranged,'cantrip').map(row=>row.id),
  ['ordinary-cantrip','create-thrall','divider:alpha']);
persisted=setSpellDividerTitle(persisted,'divider:alpha','  Мои чары\nпосле боя');
arranged=resolveSpellLayout(base,persisted);
assert.equal(arranged.find(row=>row.id==='divider:alpha')?.title,'  Мои чары после боя');
persisted=moveSpellLayout(base,persisted,'divider:alpha','focus');
assert.equal(spellZoneRows(resolveSpellLayout(base,persisted),'focus').at(-1).id,'divider:alpha');
persisted=deleteSpellDivider(persisted,'divider:alpha');
assert.equal(readSpellLayout(persisted).some(row=>row.id==='divider:alpha'),false);

assert.deepEqual(readSpellLayout('invalid'),[]);
assert.deepEqual(readSpellLayout('{"version":5,"items":[]}'),[]);
assert.deepEqual(readSpellLayout('{"version":1,"items":[{"kind":"spell","id":"x","zone":"unsafe"}]}'),[]);
const switched=resolveSpellLayout(base.slice(0,3),persisted);
assert.equal(switched.some(row=>row.id==='healing'),false,'Removed or unprepared spells do not reappear');
const readded=resolveSpellLayout(base,persisted);
assert.equal(readded.find(row=>row.id==='bone-spear').zone,'spellbook-right',
  'Removing and later preparing a spell retains its saved manual zone');

const details={pathfinderSheet:{name:'Маг',schemaVersion:1},other:'unchanged'};
const saved=persistSheetValues(details,{...initialSheetValues(details,'Маг'),[PF_SPELL_LAYOUT]:persisted},'Маг');
const recovered=initialSheetValues(saved,'Маг');
assert.equal(recovered[PF_SPELL_LAYOUT],persisted,'Dividers, manual ordering and placements survive JSON v1');
assert.equal(saved.other,'unchanged');

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const alt=read('../src/features/pathfinder/AlternativePathfinderPages.tsx');
const ui=read('../src/features/pathfinder/SpellLayoutControls.tsx');
assert.ok(sheet.includes('useSpellLayoutUi(preparedSpellViews'));
assert.ok(sheet.includes('spellClassicFieldZone(fieldId)'));
assert.ok(sheet.includes('<SpellDividerAdd'));
assert.ok(alt.includes('data-pf-spell-zone={zone}'));
assert.ok(alt.includes('spellLayout.inZone(zone)'));
assert.ok(alt.includes('<SpellDivider row={row}'));
assert.ok(ui.includes('setPointerCapture')&&ui.includes('document.elementFromPoint'),
  'Pointer-driven drag and drop also works on touchscreens');
assert.ok(ui.includes('onContextMenu')===false||ui.includes('context'),
  'Right-click opens context menu and creates labeled dividers');
console.log('PASS: automatic spell zones, touch drag semantics, cross-panel overrides, separators, JSON v1 and both layouts');
