import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PAGE_IDS,PAGE_LABELS,PF_PAGE_ORDER_KEY,PF_NOTES_ENABLED_KEY,PF_NOTES_CONTENT_KEY,
  parsePageOrder,visiblePageOrder,movePage,shiftVisiblePage,serializePageOrder,notesPageEnabled,
} from '../src/features/pathfinder/page-order.ts';
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
assert.deepEqual(parsePageOrder(undefined),['1','2','3','4','notes']);
assert.deepEqual(parsePageOrder('4,2,4,bad,1'),['4','2','1','3','notes']);
assert.deepEqual(parsePageOrder(''),[...PAGE_IDS]);
assert.deepEqual(parsePageOrder('notes,4,3,2,1'),['notes','4','3','2','1']);
assert.deepEqual(visiblePageOrder(parsePageOrder('notes,4,3,2,1'),false),['4','3','2','1']);
assert.deepEqual(visiblePageOrder(parsePageOrder('notes,4,3,2,1'),true),['notes','4','3','2','1']);
assert.deepEqual(movePage(PAGE_IDS,'4','1'),['4','1','2','3','notes']);
assert.deepEqual(movePage(PAGE_IDS,'1','4'),['2','3','4','1','notes']);
assert.deepEqual(movePage(PAGE_IDS,'3','3'),[...PAGE_IDS]);
assert.deepEqual(shiftVisiblePage(PAGE_IDS,'3',-1,false),['1','3','2','4','notes']);
assert.deepEqual(shiftVisiblePage(PAGE_IDS,'3',1,false),['1','2','4','3','notes']);
assert.deepEqual(shiftVisiblePage(PAGE_IDS,'4',1,false),[...PAGE_IDS]);
assert.deepEqual(shiftVisiblePage(['1','notes','2','3','4'],'1',1,false),['notes','2','1','3','4']);
assert.equal(serializePageOrder(['4','3','2','1','notes']),'4,3,2,1,notes');
assert.equal(PAGE_LABELS.notes,'Заметки');
assert.equal(notesPageEnabled(true),true);
assert.equal(notesPageEnabled('true'),true);
assert.equal(notesPageEnabled(false),false);
assert.equal(notesPageEnabled(undefined),false);

const starting={notes:'Original details untouched',pathfinderSheet:{
  name:'Эльф',schemaVersion:1,level:'7',ability_cha:'+3',spell_attack:'+10',
  [PF_NOTES_ENABLED_KEY]:true,
  [PF_NOTES_CONTENT_KEY]:'ays:rich:v1:<div><b>Заметка</b></div>',
  [PF_PAGE_ORDER_KEY]:'4,2,notes,1,3',
}};
const loaded=initialSheetValues(starting,'Эльф');
assert.deepEqual(visiblePageOrder(parsePageOrder(loaded[PF_PAGE_ORDER_KEY]),notesPageEnabled(loaded[PF_NOTES_ENABLED_KEY])),['4','2','notes','1','3']);
const reordered=persistSheetValues(starting,{
  ...loaded,[PF_PAGE_ORDER_KEY]:'3,4,1,notes,2',
},'Эльф');
const resaved=initialSheetValues(reordered,'Эльф');
assert.equal(resaved[PF_NOTES_CONTENT_KEY],loaded[PF_NOTES_CONTENT_KEY]);
assert.equal(resaved.level,'7');
assert.equal(resaved.spell_attack,'+10');
assert.equal(resaved[PF_PAGE_ORDER_KEY],'3,4,1,notes,2');
assert.equal(reordered.notes,'Original details untouched');
// An absent/false toggle must NOT delete a character's saved notes.
const hidden=persistSheetValues(reordered,{...resaved,[PF_NOTES_ENABLED_KEY]:false},'Эльф');
const hiddenRead=initialSheetValues(hidden,'Эльф');
assert.equal(hiddenRead[PF_NOTES_ENABLED_KEY],undefined);
assert.equal(hiddenRead[PF_NOTES_CONTENT_KEY],resaved[PF_NOTES_CONTENT_KEY]);
assert.deepEqual(visiblePageOrder(parsePageOrder(hiddenRead[PF_PAGE_ORDER_KEY]),false),['3','4','1','2']);
assert.deepEqual(visiblePageOrder(parsePageOrder(hiddenRead[PF_PAGE_ORDER_KEY]),true),['3','4','1','notes','2']);

const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const dialog=read('../src/features/pathfinder/PageSettingsDialog.tsx');
const notes=read('../src/features/pathfinder/OptionalNotesPage.tsx');
const css=read('../src/features/pathfinder/OptionalNotesPage.css');
assert.match(sheet,/const visiblePages=useMemo\(\(\)=>visiblePageOrder\(pageOrder,notesEnabled\)/);
assert.match(sheet,/page==='notes'[\s\S]*?<OptionalNotesPage/);
assert.match(sheet,/renderPage\(Number\(page\)\)/);
assert.match(sheet,/PF_NOTES_CONTENT_KEY,text/);
assert.match(sheet,/onNotesEnabled=\{setNotesPageEnabled\}/);
assert.match(sheet,/onOrderChange=\{setPageOrder\}/);
assert.match(sheet,/PAGE_LABELS\[page\]/);
assert.match(sheet,/document\.getElementById\('pf-sheet-page-'\+page\)/);
assert.match(sheet,/persistSheetValues\(character\.details, toStore, cleanName\)/);
assert.match(sheet,/Страницы листа…/);
assert.match(notes,/id="pf-sheet-page-notes"/);
assert.match(notes,/className="pf-sheet-page pf-optional-notes-page"/);
assert.match(notes,/className="pf-optional-notes-rich" grow/);
assert.match(notes,/resourceContext=\{values\}/);
assert.match(notes,/onChange=\{onChange\}/);
assert.doesNotMatch(notes,/\.webp|\.pdf|<img/,'Notes page must not use an image/PDF fixed art layer');
assert.match(css,/\.pf-optional-notes-page\s*\{[^}]*aspect-ratio:auto;/);
assert.match(css,/\.pf-optional-notes-rich \.pf-rich-editable\s*\{[^}]*overflow:visible;/);
assert.match(dialog,/draggable=\{!disabled\}/);
assert.match(dialog,/event\.dataTransfer\.setData\('text\/plain',id\)/);
assert.match(dialog,/onDrop=\{event=>dropPage\(event,id\)\}/);
assert.match(dialog,/shiftVisiblePage\(order,id,-1,notesEnabled\)/);
assert.match(dialog,/shiftVisiblePage\(order,id,1,notesEnabled\)/);
assert.match(dialog,/checked=\{notesEnabled\}/);
assert.match(dialog,/role="dialog" aria-modal="true"/);
assert.match(dialog,/Выключение дополнительного листа только скрывает его/);
console.log('PF2e: optional rich notes, safe reorder, restored visibility, navigation and JSON data persistence tested.');
