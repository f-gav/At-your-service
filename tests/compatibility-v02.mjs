import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';

// Production modules intentionally use Vite-resolved extensionless imports.
// Bundle the actual TypeScript sources for Node tests, stubbing only the
// network-only Supabase client (no live queries or uploads are performed).
async function loadForTest(entry){
  const output=await build({
    entryPoints:[entry],bundle:true,write:false,platform:'node',format:'esm',
    plugins:[{name:'supabase-network-stub',setup(builder){
      builder.onResolve({filter:new RegExp('/lib/supabase'+'$')},()=>({path:'test-supabase',namespace:'compat-stub'}));
      builder.onLoad({filter:/.*/,namespace:'compat-stub'},()=>({
        contents:'export const supabase=null;',loader:'js'
      }));
    }}],
  });
  return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'));
}
const {exportCharacter,parseCharacterJson}=await loadForTest('src/lib/character-json.ts');
const {parsePortraitTransfer}=await loadForTest('src/features/portrait/portrait-json.ts');
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';
import {readMoonSheet,saveMoonSheet} from '../src/features/project-moon/model.ts';
import {validCrops} from '../src/features/portrait/crop.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const character={
 id:'test-character',user_id:'test-owner',system:'pf2e',name:'Персонаж',
 created_at:'',updated_at:'',sort_order:0,
 portrait_card_path:null,portrait_sheet_path:null,portrait_source_path:null,portrait_crops:null,
 details:{notes:'Нельзя потерять',futureGlobal:{revision:22},pathfinderSheet:{
   name:'Персонаж',schemaVersion:1,level:'12',pf2e_layout:'classic',
   pf_spell_library_selection:'[{"id":"spell-1","prepared":true}]',
   unknown_custom_field:'Оставить',deleted_template_field:'Скрытый текст',
   futureObject:{value:37},pf2e_notes_content:'Текст заметок',
 }},
};
const exported=exportCharacter(character);
assert.equal(exported.version,2);
assert.ok(!('pathfinderSheet' in exported.character.details),'v2 keeps sheet values outside common metadata');
assert.equal(exported.character.sheet.fields.unknown_custom_field,'Оставить');
assert.equal(exported.character.sheet.page.layout,'classic');
assert.deepEqual(exported.character.sheet.spells.selection,[{id:'spell-1',prepared:true}]);
assert.ok(!('user_id' in exported.character),'Exported JSON must not carry previous ownership');
const legacy=parseCharacterJson(JSON.stringify(exported));
assert.equal(legacy.system,'pf2e');
assert.equal(legacy.details.pathfinderSheet.unknown_custom_field,'Оставить');
assert.deepEqual(legacy.details.futureGlobal,{revision:22});

const original=initialSheetValues(legacy.details,legacy.name);
for(const layout of ['alternative','classic','alternative']){
  const saved=persistSheetValues(legacy.details,{...original,pf2e_layout:layout},legacy.name);
  const next=initialSheetValues(saved,legacy.name);
  assert.equal(next.pf2e_layout,layout);
  for(const key of ['level','pf_spell_library_selection','unknown_custom_field','deleted_template_field','pf2e_notes_content']){
    assert.equal(next[key],original[key],'Layout switch must preserve '+key);
  }
  assert.deepEqual(saved.pathfinderSheet.futureObject,{value:37});
  assert.equal(saved.notes,'Нельзя потерять');
}
// A real v1 payload still imports using the original flat data model.
const oldPf={system:'Pathfinder',format:'at-your-service-character',version:1,
 character:{name:'Персонаж',details:{pathfinderSheet:{level:'3'}}}};
const parsedOldPf=parseCharacterJson(JSON.stringify(oldPf));
assert.equal(parsedOldPf.details.pathfinderSheet.level,'3');
assert.equal(parsedOldPf.details.pathfinderSheet.pf2e_layout,undefined,'Missing layout is valid legacy JSON');
assert.throws(()=>parseCharacterJson(JSON.stringify({...exported,version:3})),/формат|версия/);
assert.throws(()=>parseCharacterJson(JSON.stringify({...exported,system:'DnD'})),/позже/);
assert.throws(()=>parseCharacterJson(JSON.stringify({...oldPf,character:{...oldPf.character,details:{pathfinderSheet:[]}}})),/Pathfinder/);

const moonExport={
 system:'Project Moon',format:'at-your-service-character',version:1,
 character:{name:'Лунный персонаж',details:{concept:'Тест',projectMoonSheet:{
   fields:{rank:'4',organization:'Офис'},notes:[{title:'Старые заметки',body:'Важный текст'}],
   skills:[{title:'Удар',body:'Описание'}],inventoryColumns:4,
   textSizes:{inventory:18},futureRules:{keep:true},
 }}}};
const moon=parseCharacterJson(JSON.stringify(moonExport));
assert.equal(moon.system,'prmoon');
const oldMoon=readMoonSheet(moon.details);
assert.equal(oldMoon.notes[0].id,'note-1','Legacy notes without ID require note-prefixed IDs');
assert.equal(oldMoon.skills[0].id,'skill-1');
assert.equal(oldMoon.notes[0].body,'Важный текст');
assert.equal(oldMoon.inventoryColumns,4);
assert.equal(oldMoon.textSizes.inventory,18);
const reSaved=saveMoonSheet(moon.details,oldMoon);
assert.deepEqual(reSaved.projectMoonSheet.futureRules,{keep:true});
assert.equal(readMoonSheet(reSaved).notes[0].id,'note-1');
assert.equal(readMoonSheet(reSaved).fields.rank,'4');
assert.equal(readMoonSheet({projectMoonSheet:{fields:{rank:'2'}}}).inventoryColumns,1);
assert.equal(readMoonSheet({projectMoonSheet:{inventoryColumns:10}}).inventoryColumns,4);
assert.equal(readMoonSheet({projectMoonSheet:{inventoryColumns:-2}}).inventoryColumns,1);

const frame={x:0,y:0,w:1,h:1};
const crops={card:frame,sheet:frame};
assert.ok(validCrops(crops));
const fakeWebp=Buffer.alloc(450000);
fakeWebp.write('RIFF',0);fakeWebp.write('WEBP',8);
const dataUrl='data:image/webp;base64,'+fakeWebp.toString('base64');
const newPortrait=parsePortraitTransfer({source:dataUrl,crops});
assert.equal(newPortrait.type,'source');
assert.equal(newPortrait.source.size,450000,'JSON v1 allows the full 450KB storage limit');
const oldPortrait=parsePortraitTransfer({card:dataUrl,sheet:dataUrl});
assert.equal(oldPortrait.type,'legacy');
assert.equal(oldPortrait.card.size,450000);
assert.equal(oldPortrait.sheet.size,450000);
assert.throws(()=>parsePortraitTransfer({source:dataUrl,crops:{card:{...frame,w:2},sheet:frame}}),/кадр/);
assert.throws(()=>parsePortraitTransfer({card:dataUrl}),/старый/);
assert.equal(parsePortraitTransfer(undefined),undefined);
const storage=read('../src/features/portrait/portrait-storage.ts');
assert.match(storage,/blob\.size>450000/,'Uploads must accept any previously exportable valid 450KB WebP');
const app=read('../src/App.tsx');
assert.ok(app.includes('saveLegacyPortrait(') && app.includes('savePortrait('));
assert.ok(app.includes('pf2e_layout:variant'));
assert.ok(app.includes('setPendingImport(parsed)'));
// The former spell text tables do not belong in exports that already use the
// library. Layout must not resurrect removed or unprepared spell positions.
const spellSample={...character,details:{notes:'Сюжет',pathfinderSheet:{
  schemaVersion:1,name:'Персонаж',level:'1',pf2e_layout:'alternative',
  cantrip_names:'Старый текст',cantrip_actions:'<br>',
  pf_spell_library_selection:JSON.stringify([
    {id:'pf2e-harm',prepared:true},{id:'pf2e-unprepared',prepared:false}
  ]),
  pf_spell_library_layout_v1:JSON.stringify({version:1,items:[
    {kind:'spell',id:'pf2e-harm',zone:'spellbook-left'},
    {kind:'spell',id:'pf2e-orphan',zone:'spellbook-left'},
    {kind:'spell',id:'pf2e-unprepared',zone:'spellbook-left'},
    {kind:'divider',id:'divider:note',zone:'spellbook-left',title:'Подготовлено'}
  ]}),
  pf_spell_available_classes:'["necromancer"]',
  pf2e_page_order:'1,2,3,4,notes',
  pf2e_notes_enabled:true,
  pf2e_notes_content:'История персонажа',
  custom_template_field:'Сохранить навсегда',
}}};
const portable=exportCharacter(spellSample);
assert.equal(portable.version,2);
assert.ok(!('cantrip_names' in portable.character.sheet.fields));
assert.ok(!('cantrip_actions' in portable.character.sheet.fields));
assert.deepEqual(portable.character.sheet.spells.layout.items.map(x=>x.id),['pf2e-harm','divider:note']);
assert.deepEqual(portable.character.sheet.spells.classes,['necromancer']);
const restored=parseCharacterJson(JSON.stringify(portable));
assert.equal(restored.details.pathfinderSheet.custom_template_field,'Сохранить навсегда');
assert.equal(restored.details.pathfinderSheet.pf2e_notes_content,'История персонажа');
assert.equal(restored.details.pathfinderSheet.pf2e_page_order,'1,2,3,4,notes');
assert.deepEqual(JSON.parse(restored.details.pathfinderSheet.pf_spell_library_selection),[
 {id:'pf2e-harm',prepared:true},{id:'pf2e-unprepared',prepared:false}]);
assert.deepEqual(JSON.parse(restored.details.pathfinderSheet.pf_spell_library_layout_v1).items.map(x=>x.id),
 ['pf2e-harm','divider:note']);
const textVersion={...spellSample,details:{...spellSample.details,
 pathfinderSheet:{...spellSample.details.pathfinderSheet,pf_spell_display_mode:'text'}}};
assert.equal(exportCharacter(textVersion).character.sheet.fields.cantrip_names,'Старый текст',
 'Text-mode spells are still editable and must not be discarded');
assert.equal(parseCharacterJson(JSON.stringify(oldPf)).details.pathfinderSheet.level,'3');
assert.throws(()=>parseCharacterJson(JSON.stringify({...portable,
 character:{...portable.character,sheet:{fields:[]}}})),/Pathfinder/);
const moonV2=exportCharacter({...character,system:'prmoon',details:moon.details});
assert.equal(moonV2.version,2);
assert.equal(moonV2.character.sheet.fields.rank,'4');
assert.equal(parseCharacterJson(JSON.stringify(moonV2)).details.projectMoonSheet.futureRules.keep,true);
console.log('PASS: JSON v2 grouped roundtrip, cleaned library tables, current PF fields, v1 import, Project Moon and portraits');
