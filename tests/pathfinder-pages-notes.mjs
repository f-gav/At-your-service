import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PAGE_IDS,PAGE_LABELS,PF_PAGE_ORDER_KEY,PF_NOTES_ENABLED_KEY,PF_HIDDEN_PAGES_KEY,PF_NOTES_CONTENT_KEY,
  parsePageOrder,visiblePageOrder,movePage,shiftVisiblePage,serializePageOrder,notesPageEnabled,
} from '../src/features/pathfinder/page-order.ts';
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';
import {parseHiddenPageIds,setPageVisible,visiblePageIds} from '../src/lib/page-visibility.ts';
import {richToolbarPosition} from '../src/features/pathfinder/rich-toolbar-position.ts';

import {
  PF_NOTES_BLOCK_COUNT, PF_NOTES_HEIGHT_MIN, PF_NOTES_HEIGHT_MAX,
  noteBodyKey, noteTitleKey, noteHeightKey, noteBlockTitle, noteBlockHeight, resizeNoteBlock,
} from '../src/features/pathfinder/notes-blocks.ts';

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
assert.deepEqual(parseHiddenPageIds('2,4,4,unknown',PAGE_IDS),['2','4']);
assert.deepEqual(visiblePageOrder(PAGE_IDS,true,['2','notes']),['1','3','4']);
assert.deepEqual(visiblePageOrder(PAGE_IDS,false,['2','notes']),['1','3','4']);
assert.deepEqual(setPageVisible(['1','2'],['2'],'1',false),['2'],'At least one page must stay visible');
assert.deepEqual(setPageVisible(PAGE_IDS,['1','2'],'2',true),['1']);
assert.deepEqual(visiblePageIds(['1','2','3'],['1']),['2','3']);
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
assert.match(sheet,/const visiblePages=useMemo\(\(\)=>visiblePageOrder\(pageOrder,notesEnabled,hiddenPages\)/);
assert.match(sheet,/page==='notes'[\s\S]*?<OptionalNotesPage/);
assert.match(sheet,/renderPage\(Number\(page\)\)/);
assert.match(sheet,/onChange=\{\(id,value\)=>change\(id,value\)\}/);
assert.match(sheet,/onNotesEnabled=\{setNotesPageEnabled\}/);
assert.match(sheet,/onOrderChange=\{setPageOrder\}/);
assert.match(sheet,/onPageVisibility=\{setPageVisibility\}/);
assert.match(sheet,/PF_HIDDEN_PAGES_KEY/);
assert.match(dialog,/aria-pressed=\{!hiddenPages.includes\(id\)\}/);
assert.match(notes,/aria-label=\{`Название заметки/);
assert.match(sheet,/PAGE_LABELS\[page\]/);
assert.match(sheet,/document\.getElementById\('pf-sheet-page-'\+page\)/);
assert.match(sheet,/persistSheetValues\(character\.details,stored,cleanName\)/);
assert.match(sheet,/Страницы листа…/);
assert.match(notes,/id="pf-sheet-page-notes"/);
assert.match(notes,/className="pf-sheet-page pf-optional-notes-page"/);
assert.ok(notes.includes('className="pf-optional-note-card-body"'));
assert.match(notes,/resourceContext=\{values\}/);
assert.match(notes,/onTextSizeChange=\{size=>onChange\('pf_text_size_'\+noteBodyKey\(index\),String\(size\)\)\}/,
  'Classic and HTML notes must share their saved text-size keys');
assert.match(notes,/textSize=\{Number\(values\['pf_text_size_'\+noteBodyKey\(index\)\]\)/,
  'Previously chosen note text size must display on the classic page');
assert.match(notes,/onChange=\{next => onChange\(noteBodyKey\(index\), next\)\}/);
assert.ok(notes.includes('notes-page.svg'));
assert.ok(notes.includes('<img'));
assert.ok(css.includes('aspect-ratio: 1573 / 2048;'));
assert.ok(css.includes('overflow: auto;'));
assert.match(dialog,/draggable=\{!disabled\}/);
assert.match(dialog,/event\.dataTransfer\.setData\('text\/plain',id\)/);
assert.match(dialog,/onDrop=\{event=>dropPage\(event,id\)\}/);
assert.match(dialog,/shiftVisiblePage\(order,id,-1,notesEnabled\)/);
assert.match(dialog,/shiftVisiblePage\(order,id,1,notesEnabled\)/);
assert.match(dialog,/checked=\{notesEnabled\}/);
assert.match(dialog,/role="dialog" aria-modal="true"/);
assert.match(dialog,/Скрытые страницы не удаляются/);

// The original notes text stays in its historical key; all other blocks,
// headings, and resized heights use independent stable keys.
assert.equal(PF_NOTES_BLOCK_COUNT, 6);
assert.equal(noteBodyKey(0), PF_NOTES_CONTENT_KEY);
assert.equal(noteBodyKey(1), 'pf2e_notes_block_2');
assert.equal(noteBodyKey(5), 'pf2e_notes_block_6');
assert.equal(noteTitleKey(0), 'pf2e_notes_title_1');
assert.equal(noteHeightKey(5), 'pf2e_notes_height_6');
assert.equal(noteBlockTitle(''), 'Заметки');
assert.equal(noteBlockTitle('  Дневник  '), 'Дневник');
assert.equal(noteBlockHeight(undefined), 36);
assert.equal(noteBlockHeight('bad'), 36);
assert.equal(noteBlockHeight('1000'), PF_NOTES_HEIGHT_MAX);
assert.equal(noteBlockHeight('0'), PF_NOTES_HEIGHT_MIN);
assert.equal(resizeNoteBlock(undefined, 1), '44');
assert.equal(resizeNoteBlock(undefined, -1), '28');
assert.equal(resizeNoteBlock(String(PF_NOTES_HEIGHT_MAX), 1), String(PF_NOTES_HEIGHT_MAX));
assert.equal(resizeNoteBlock(String(PF_NOTES_HEIGHT_MIN), -1), String(PF_NOTES_HEIGHT_MIN));
assert.throws(() => noteBodyKey(6), RangeError);
const multipleNotes = persistSheetValues(starting, {
  ...loaded,
  [noteBodyKey(1)]: 'ays:rich:v1:<div>Вторая заметка</div>',
  [noteTitleKey(1)]: 'Зацепки',
  [noteHeightKey(1)]: '44',
}, 'Эльф');
const reloadedMultiple = initialSheetValues(multipleNotes, 'Эльф');
assert.equal(reloadedMultiple[PF_NOTES_CONTENT_KEY], loaded[PF_NOTES_CONTENT_KEY]);
assert.equal(reloadedMultiple[noteBodyKey(1)], 'ays:rich:v1:<div>Вторая заметка</div>');
assert.equal(reloadedMultiple[noteTitleKey(1)], 'Зацепки');
assert.equal(reloadedMultiple[noteHeightKey(1)], '44');
assert.equal(multipleNotes.pathfinderSheet.schemaVersion, 1);
assert.match(notes, /Array\.from\(\{length: PF_NOTES_BLOCK_COUNT\}/);
assert.match(notes, /className="pf-optional-notes-grid"/);
assert.ok(notes.includes('noteTitleKey(index)'));
assert.match(read('../src/features/pathfinder/AlternativePathfinderPages.tsx'),/className="pf-alt-note-title"/);
assert.ok(css.includes('grid-template-rows: .507fr 1fr 1fr;'));
assert.ok(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));
assert.match(notes, /pf-optional-notes-grid/);
assert.doesNotMatch(notes, /pf-optional-note-card-controls|pf-optional-notes-heading/);
console.log('PF2e: optional rich notes, safe reorder, restored visibility, navigation and JSON data persistence tested.');

const hiddenDetails=persistSheetValues(starting,{...loaded,[PF_HIDDEN_PAGES_KEY]:'2,4',
  [noteTitleKey(0)]:'Прошлое героя'},'Эльф');
const hiddenReopen=initialSheetValues(hiddenDetails,'Эльф');
assert.deepEqual(visiblePageOrder(parsePageOrder(hiddenReopen[PF_PAGE_ORDER_KEY]),true,
  parseHiddenPageIds(hiddenReopen[PF_HIDDEN_PAGES_KEY],PAGE_IDS)),['notes','1','3']);
assert.equal(hiddenReopen[noteTitleKey(0)],'Прошлое героя');
assert.equal(hiddenReopen[PF_NOTES_CONTENT_KEY],loaded[PF_NOTES_CONTENT_KEY]);
const viewport={width:390,height:550,offsetLeft:0,offsetTop:0};
const selection={left:130,top:125,bottom:145,width:70};
const mobile=richToolbarPosition(selection,viewport,true);
const desktop=richToolbarPosition(selection,viewport,false);
assert.ok(mobile.top>selection.bottom,'Mobile toolbar appears below selected text');
assert.ok(desktop.top<selection.top,'Desktop toolbar remains above selected text');
const lower=richToolbarPosition({...selection,top:525,bottom:545},viewport,true);
assert.ok(lower.top<=viewport.height-48,'Mobile toolbar stays above visual keyboard/viewport limit');
assert.ok(lower.left>=8&&lower.left<=390-8);
console.log('PASS: saved page hiding, restored note titles and mobile rich toolbar placement');
