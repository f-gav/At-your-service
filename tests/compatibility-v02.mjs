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
assert.equal(exported.version,1);
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
const oldPf={...exported,character:{...exported.character,details:{pathfinderSheet:{level:'3'}}}};
const parsedOldPf=parseCharacterJson(JSON.stringify(oldPf));
assert.equal(parsedOldPf.details.pathfinderSheet.level,'3');
assert.equal(parsedOldPf.details.pathfinderSheet.pf2e_layout,undefined,'Missing layout is valid legacy JSON');
assert.throws(()=>parseCharacterJson(JSON.stringify({...exported,version:2})),/формат|версия/);
assert.throws(()=>parseCharacterJson(JSON.stringify({...exported,system:'DnD'})),/позже/);
assert.throws(()=>parseCharacterJson(JSON.stringify({...exported,character:{...exported.character,details:{pathfinderSheet:[]}}})),/Pathfinder/);

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
console.log('PASS: 0.2.3 JSON v1, two PF2e layouts, removed template fields, Moon legacy notes and both portrait transfers');
