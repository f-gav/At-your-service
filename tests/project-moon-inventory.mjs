import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyMoonSheet,readMoonSheet,saveMoonSheet} from '../src/features/project-moon/model.ts';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const template=emptyMoonSheet();
const texts=[
  'Дорожная сумка и аптечка',
  'Кинжал и запасная амуниция',
  'data-pf-spoiler="1" — закрытый список вещей',
  'data-pf-divider="1" — наименование раздела'
];
for(let i=0;i<4;i++){
  const key=i===0?'inventory':'inventory'+(i+1);
  template.fields[key]=texts[i];
  template.textSizes[key]=8+i*4;
}
template.textSizes['note:note-1']=21;
template.notes[0].body='Важные сведения о кампании';
template.notes[1].body='Заметки второго блока';
const snapshots=[];
for(const visible of [4,1,2,3,4]){
  template.inventoryColumns=visible;
  const encoded=JSON.parse(JSON.stringify(saveMoonSheet({unrelated:{preserved:true}},template)));
  const roundtrip=readMoonSheet(encoded);
  snapshots.push(roundtrip);
  assert.equal(roundtrip.inventoryColumns,visible);
  for(let i=0;i<4;i++){
    const key=i===0?'inventory':'inventory'+(i+1);
    assert.equal(roundtrip.fields[key],texts[i],'Hidden inventory must not be erased: '+key);
    assert.equal(roundtrip.textSizes[key],8+i*4);
  }
  assert.equal(roundtrip.textSizes['note:note-1'],21);
  assert.equal(roundtrip.notes[0].body,'Важные сведения о кампании');
  assert.equal(encoded.unrelated.preserved,true);
}
assert.deepEqual(snapshots[0].fields,snapshots[4].fields);
assert.equal(readMoonSheet({projectMoonSheet:{inventoryColumns:999}}).inventoryColumns,4);
assert.equal(readMoonSheet({projectMoonSheet:{inventoryColumns:-1}}).inventoryColumns,1);

const jsx=read('../src/features/project-moon/ProjectMoonSheet.tsx');
const css=read('../src/features/project-moon/ProjectMoonSheet.css');
const rich=read('../src/features/pathfinder/RichField.tsx');
const markup=read('../src/features/pathfinder/rich-blocks.ts');
assert.match(jsx,/Array\.from\(\{ length: sheet\.inventoryColumns \}/,
  'The grid must display only requested columns without deleting stored data');
assert.ok(jsx.includes("index === 0 ? 'inventory' : 'inventory' + (index + 1)"));
assert.ok(jsx.includes('Содержимое скрытых колонок сохранено'));
assert.ok(jsx.includes("textSizeControls('note:' + note.id)"));
assert.ok(jsx.includes("sheet.textSizes['note:' + note.id] ?? 12"));
assert.ok(jsx.includes('moon-card moon-note moon-resizable-text'));
assert.ok(css.includes('.moon-paper .moon-resizable-text .pf-rich-editable'));
assert.ok(css.includes('font-size: var(--moon-editor-text-size,12px)'));
assert.ok(css.includes('background-size: 100% 1lh'),
  'Background rules must grow with text line-height');
assert.ok(css.includes('.moon-inventory-column + .moon-inventory-column { border-left:'));
assert.ok(css.includes('.moon-inventory-column .pf-rich-editable [data-pf-spoiler="1"]'));
assert.ok(css.includes('.moon-inventory-column .pf-rich-editable [data-pf-divider="1"]'));
assert.ok(markup.includes('data-pf-spoiler="1"'));
assert.ok(markup.includes('data-pf-divider="1"'));
assert.ok(rich.includes('serializeRichHtml(editor.innerHTML)'),
  'Rich editor must still persist dividers and spoiler bodies');
assert.ok(jsx.includes('useAutoSave({'),'Moon inventory must use same autosave pipeline');
assert.ok(jsx.includes("exportRenderedSheetPdf(pdfRoot.current,name,'prmoon')"));
console.log('PASS: inventory 1–4 columns survive JSON, hidden fields remain, notes scale and rich widgets stay column bounded');
