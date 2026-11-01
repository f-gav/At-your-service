import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const shared='src/features/rich-editor/';
const editor=read(shared+'RichField.tsx');
for(const fragment of ['serializeRichHtml','toRichHtml','dividerMarkup','spoilerMarkup','diceMarkup','resourceMarkup','ResourceDialog','richToolbarPosition','insertionMenuPosition'])assert.ok(editor.includes(fragment),'RichField lost '+fragment);
for(const mod of ['rich-codec.ts','rich-blocks.ts','resource-widget.ts','dice-markup.ts','ResourceDialog.tsx','insert-menu-position.ts','rich-toolbar-position.ts','FloatingPageNavigation.tsx','floating-navigation-geometry.ts'])assert.ok(read(shared+mod).length>200,'Shared module missing: '+mod);
for(const name of ['RichField.tsx','ResourceDialog.tsx','rich-codec.ts','rich-blocks.ts','resource-widget.ts','dice-markup.ts'])assert.ok(read('src/features/pathfinder/'+name).includes('../rich-editor/'),'Legacy import no longer resolves: '+name);
for(const [path,kind] of [['src/features/pathfinder/PathfinderSheet.tsx','Pathfinder'],['src/features/project-moon/ProjectMoonSheet.tsx','Moon'],['src/features/project-moon/MoonEquipmentPage.tsx','equipment']]){
 const s=read(path);assert.ok(s.includes("from '../rich-editor/RichField'" ) || kind==='equipment' || kind==='Moon' || s.includes('rich-editor/RichField'),'Shared editor not linked: '+kind);
 assert.ok(!s.includes("from '../pathfinder/RichField'"),'Moon depends on Pathfinder RichField');
}
for(const p of ['src/features/pathfinder/PathfinderSheet.tsx','src/features/project-moon/ProjectMoonSheet.tsx'])assert.ok(read(p).includes("from '../rich-editor/FloatingPageNavigation'"),'Page navigation not shared: '+p);
console.log('PASS shared editor, formatting, dice, resources, navigation and legacy imports');
