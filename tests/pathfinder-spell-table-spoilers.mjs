import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PF_SPELL_TABLES,spellTableSpan} from '../src/features/pathfinder/spell-table-spoilers.ts';
import {spoilerMarkup} from '../src/features/pathfinder/rich-blocks.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const fields=JSON.parse(read('../src/features/pathfinder/fields.json'));
assert.equal(PF_SPELL_TABLES.length,3);
assert.deepEqual(PF_SPELL_TABLES.map(group=>group.length),[3,4,4]);
for (const ids of PF_SPELL_TABLES) {
  const memberFields=ids.map(id=>fields.find(f=>f.id===id));
  assert.ok(memberFields.every(Boolean),'Missing a spell table field');
  const left=Math.min(...memberFields.map(f=>f.x));
  const right=Math.max(...memberFields.map(f=>f.x+f.w));
  const width=right-left;
  for(const field of memberFields) {
    const span=spellTableSpan(field,fields);
    assert.ok(span,'All columns, not just Names, must support a row spoiler');
    assert.ok(Math.abs(span.width-width)<.001);
    assert.ok(Math.abs(span.offset-(field.x-left))<.001);
  }
  const moved=memberFields.map((f,index)=>({...f,x:f.x+12+index*.1,w:f.w+(index*.35)}));
  const changed=fields.filter(f=>!ids.includes(f.id)).concat(moved);
  for(const field of moved) {
    const result=spellTableSpan(field,changed);
    assert.ok(result?.width>0,'Respect fields repositioned by the PDF template editor');
    assert.ok(result.offset>=0);
  }
}
const unrelated=fields.find(f=>f.id==='focus_spells');
assert.equal(spellTableSpan(unrelated,fields),null,'Other long fields do not change');
const action=fields.find(f=>f.id==='action_1_effect');
assert.equal(spellTableSpan(action,fields),null,'Other pages do not change');
const remaining=fields.filter(f=>f.id!=='cantrip_actions');
assert.ok(spellTableSpan(fields.find(f=>f.id==='cantrip_names'),remaining),'One missing column should not break saved sheets');
const single=fields.filter(f=>f.id==='cantrip_names');
assert.equal(spellTableSpan(single[0],single),null,'No span without a table');

const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const css=read('../src/features/pathfinder/RichField.css');
assert.ok(sheet.includes("const tableSpan = spellTableSpan(field, templateFields)"));
assert.ok(sheet.includes("'--pf-spell-span-width'"));
assert.ok(sheet.includes("'--pf-spell-span-offset'"));
assert.ok(sheet.includes("pf-spell-table-rich"));
// The original failure: .pf-field-long and .pf-rich-editable BOTH clipped
// their contents. The CSS rule must override overflow on both DOM levels.
assert.ok(css.includes('.pf-spell-table-rich:has([data-pf-spoiler="1"]) {'),
  'Any descendant spoiler (not only a direct child) must activate row-spanning mode');
assert.match(css,/\.pf-spell-table-rich:has\(\[data-pf-spoiler="1"\]\)\s*\{[^}]*overflow:\s*visible\s*;/,
  'The outer RichField host must stop clipping its overflow:auto');
assert.match(css,/\.pf-spell-table-rich:has\(\[data-pf-spoiler="1"\]\)\s*>\s*\.pf-rich-editable\s*\{[^}]*overflow:\s*visible\s*;/,
  'The contentEditable element must stop clipping its own overflow:auto');
assert.ok(css.includes('z-index: 11;'),'Spoilers paint above other table columns');
assert.ok(css.includes('width: var(--pf-spell-span-width, 100%)'));
assert.ok(css.includes('left: calc(-1 * var(--pf-spell-span-offset, 0px))'));
assert.ok(css.includes('> [data-pf-spoiler="1"]'),'Only spoilers, not ordinary text, span the table');
assert.ok(css.includes('div:not([data-pf-spoiler]) > [data-pf-spoiler="1"]'),
  'Widgets wrapped in an extra DOM block must also span');
assert.ok(css.includes('max-width: none;'),'Override default spoiler width cap');
assert.ok(css.includes('Plain columns retain their scrolling behavior'),
  'No unconditional overflow changes that would break normal text editing');
const hostCss=read('../src/features/pathfinder/PathfinderSheet.css');
const richDefaultCss=read('../src/features/pathfinder/RichField.css');
assert.ok(hostCss.includes('.pf-field-long { resize: none; white-space: pre-wrap; overflow: auto;'),
  'Underlying narrow fields normally remain scrollable');
assert.ok(richDefaultCss.includes('outline: 0; overflow: auto;'),
  'Underlying rich editor normally remains scrollable');
const markup=spoilerMarkup('Огненный шар','<div>Область действия</div>');
assert.ok(markup.includes('data-pf-spoiler-title="1" contenteditable="true"'));
assert.ok(markup.includes('data-pf-spoiler-body="1" contenteditable="true"'));
assert.ok(markup.includes('Область действия'));
console.log('PASS: all three PF2e spell-table spoilers span complete rows, preserving normal columns, saved markup and editable titles/bodies');
