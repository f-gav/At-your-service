import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';
import {parsePageOrder,visiblePageOrder} from '../src/features/pathfinder/page-order.ts';
import {parseHiddenPageIds,visiblePageIds} from '../src/lib/page-visibility.ts';
import {readMoonSheet,saveMoonSheet,emptyMoonSheet,updateMoonOutfit,updateMoonAugment,
  addMoonOutfit,removeMoonOutfit,addMoonAugment,removeMoonAugment,addMoonWeapon,
} from '../src/features/project-moon/model.ts';
import {readFileSync} from 'node:fs';

// Use actual JSON transport implementation, not a mock or a separately
// reimplemented codec. Network-only Supabase references are stubbed.
const output=await build({
  entryPoints:['src/lib/character-json.ts'],bundle:true,write:false,
  platform:'node',format:'esm',
  plugins:[{name:'no-network',setup(b){
    b.onResolve({filter:/\/lib\/supabase$/},()=>({path:'offline',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const supabase=null;',loader:'js'}));
  }}],
});
const {exportCharacter,parseCharacterJson}=await import(
  'data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64')
);
const base={id:'test-sheet',user_id:'offline-user',created_at:'',updated_at:'',
  sort_order:0,portrait_card_path:null,portrait_sheet_path:null,
  portrait_source_path:null,portrait_crops:null,
};
const roundtrip=character=>parseCharacterJson(JSON.stringify(exportCharacter(character)));

const pfFields={
  pf2e_layout:'alternative',pf2e_page_order:'4,2,notes,1,3',
  pf2e_hidden_pages:'2,3',pf2e_notes_enabled:true,
  pf2e_notes_content:'ays:rich:v1:<div><b>Тайные заметки</b></div>',
  pf2e_notes_block_2:'ays:rich:v1:<div>Вторая заметка</div>',
  pf2e_notes_title_2:'Кампания и подсказки',
  pf_text_size_pf2e_notes_block_2:'19',
  equipment:'Невидимое снаряжение за пределами шаблона',
  cantrip_names:'Ручные чары до переключения в библиотеку',
  cantrip_prepared:true,
  spellbook_left_names:'Ручной гримуар до перехода в библиотечный режим',
  pf_spell_display_mode:'library',
  pf_spell_library_selection:JSON.stringify([{id:'spell-1',prepared:true},{id:'spell-2',prepared:false}]),
  pf_spell_library_layout_v1:JSON.stringify({version:1,items:[
    {kind:'spell',id:'spell-1',zone:'cantrips'},
    {kind:'spell',id:'spell-2',zone:'cantrips'},
    {kind:'divider',id:'divider:one',zone:'cantrips',title:'Особые чары'},
  ]}),
  future_custom_field:'custom:ays:v2:<div>Невидимое поле</div>',
};
const character={...base,system:'pf2e',name:'Ада',details:{
  notes:'Остальные поля персонажа',otherSystemData:{version:3},
  pathfinderSheet:{...pfFields,schemaVersion:1,name:'Ада'},
}};
const port=exportCharacter(character);
assert.equal(port.character.sheet.fields.future_custom_field,pfFields.future_custom_field);
assert.equal(port.character.sheet.spells.legacyText.cantrip_names,pfFields.cantrip_names);
assert.equal(port.character.sheet.spells.legacyText.spellbook_left_names,pfFields.spellbook_left_names);
assert.ok(!('cantrip_names' in port.character.sheet.fields));
assert.deepEqual(port.character.sheet.spells.layout.items.map(x=>x.id),['spell-1','divider:one']);
const imported=roundtrip(character);
const reopened=initialSheetValues(imported.details,imported.name);
for(const [key,value] of Object.entries(pfFields)){
  if(key==='pf_spell_library_layout_v1')continue;
  assert.equal(reopened[key],value,'PF2e export-import must preserve '+key);
}
assert.deepEqual(JSON.parse(reopened.pf_spell_library_layout_v1).items.map(x=>x.id),
  ['spell-1','divider:one'],'Inactive spell position intentionally excluded from active library layout');
assert.deepEqual(visiblePageOrder(
  parsePageOrder(reopened.pf2e_page_order),true,
  parseHiddenPageIds(reopened.pf2e_hidden_pages,['1','2','3','4','notes'])),
  ['4','notes','1'],'Reordered/hidden page layout must be restored');
const toggled=persistSheetValues(imported.details,{
  ...reopened,pf2e_layout:'classic',pf_spell_display_mode:'text',
},imported.name);
const afterToggle=initialSheetValues(toggled,imported.name);
assert.equal(afterToggle.cantrip_names,pfFields.cantrip_names);
assert.equal(afterToggle.spellbook_left_names,pfFields.spellbook_left_names);
assert.equal(afterToggle.pf2e_notes_content,pfFields.pf2e_notes_content);
assert.deepEqual(toggled.otherSystemData,{version:3});
const pfReexport=roundtrip({...character,details:toggled});
assert.equal(pfReexport.details.pathfinderSheet.cantrip_names,pfFields.cantrip_names);

// Rich Project Moon sheets are allowed to exceed the old arbitrary 50-KB
// import cap while remaining inside the documented 2-MB transfer file bound.
let moon=emptyMoonSheet();
const rich='ays:rich:v1:<div>'+('Дневник персонажа. '.repeat(2800))+'</div>';
for(let i=1;i<=4;i++){
  moon.fields[i===1?'inventory':'inventory'+i]=i===1?rich:'Колонка '+i;
  moon.textSizes[i===1?'inventory':'inventory'+i]=8+i*3;
}
moon.inventoryColumns=4;
moon.pageOrder=['notes','combat','equipment','about','dossier'];
moon.hiddenPages=['equipment'];
moon.autoVitals=true;
moon.smoothWeaponSwitch=false;
moon.inlineFormatting={'outfit:outfit-1:block':'ays:rich:v1:<b>1d10+2</b>',
  'augment:augment-1:description':'ays:rich:v1:<i>Память</i>'};
moon=updateMoonOutfit(moon,'outfit-1',{name:'Костюм-герметик',effects:'Без потерь'});
moon=updateMoonAugment(moon,'augment-1',{name:'Аугмент корпуса',effects:'Не стирать',description:'Память'});
moon={...moon,equippedOutfitId:'outfit-1',
  textSizes:{...moon.textSizes,'note:note-1':22},
  notes:moon.notes.map((n,i)=>i===0?{...n,body:'Долгий разговор'}:n)};
moon=addMoonWeapon(moon,'weapon-third');
moon=addMoonOutfit(moon,'outfit-third');
moon=addMoonAugment(moon,'augment-third');
moon=updateMoonOutfit(moon,'outfit-third',{name:'Скрытый костюм'});
moon=updateMoonAugment(moon,'augment-third',{name:'Резервный аугмент'});
// Deleting one card may only clear its own formatted markup.
const oldArmor={...moon,inlineFormatting:{...moon.inlineFormatting,
  'outfit:outfit-third:effects':'ays:rich:v1:<u>Вырезанный текст</u>'}};
const removed=removeMoonOutfit(oldArmor,'outfit-third');
assert.equal(removed.inlineFormatting['outfit:outfit-third:effects'],undefined);
assert.equal(removed.inlineFormatting['outfit:outfit-1:block'],moon.inlineFormatting['outfit:outfit-1:block']);
moon=removeMoonAugment(moon,'augment-third');
assert.equal(moon.augments[0].name,'Аугмент корпуса');

const moonChar={...base,system:'prmoon',name:'Роланд',
  details:saveMoonSheet({concept:'Независимое описание',futureMetadata:{source:'older-version'}},moon)};
const serialized=JSON.stringify(exportCharacter(moonChar));
assert.ok(serialized.length>50000,'fixture must reproduce the old valid-export/import failure');
assert.ok(serialized.length<2*1024*1024);
const opened=roundtrip(moonChar);
const restored=readMoonSheet(opened.details);
for(let i=1;i<=4;i++){
  const key=i===1?'inventory':'inventory'+i;
  assert.equal(restored.fields[key],moon.fields[key],'All inventory columns survive');
  assert.equal(restored.textSizes[key],moon.textSizes[key]);
}
assert.deepEqual(restored.pageOrder,moon.pageOrder);
assert.deepEqual(restored.hiddenPages,moon.hiddenPages);
assert.deepEqual(restored.outfits,moon.outfits);
assert.deepEqual(restored.augments,moon.augments);
assert.deepEqual(restored.weapons,readMoonSheet(moonChar.details).weapons,
  'Reopen normalizes optional weapon fields but cannot lose player values');
assert.equal(restored.equippedOutfitId,moon.equippedOutfitId);
assert.deepEqual(restored.inlineFormatting,moon.inlineFormatting);
assert.equal(restored.smoothWeaponSwitch,false);
assert.equal(restored.autoVitals,true);
assert.equal(restored.textSizes['note:note-1'],22);
assert.equal(opened.details.futureMetadata.source,'older-version');
assert.deepEqual(visiblePageIds(restored.pageOrder,restored.hiddenPages),
  ['notes','combat','about','dossier']);
const savedAgain=saveMoonSheet(opened.details,restored);
assert.equal(readMoonSheet(savedAgain).fields.inventory,rich,'Autoreopen/save must retain rich text');
const reopenedAgain=roundtrip({...moonChar,details:savedAgain});
assert.equal(readMoonSheet(reopenedAgain.details).fields.inventory,rich,
  'Second import/export cannot silently truncate large inventory');
const bad={...port,character:{...port.character,sheet:{
  ...port.character.sheet,spells:{...port.character.sheet.spells,
    legacyText:{cantrip_names:'ok',unauthorized_key:'not allowed'}},
}}};
assert.throws(()=>parseCharacterJson(JSON.stringify(bad)),/резервная таблица/);
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
assert.ok(app.includes('downloadCharacter(freshest)'),'Export must use server-confirmed row');
assert.ok(app.includes('recoverLocalDraft(key,baseline)'),
  'Unsaved device edits must stop stale character JSON export');
console.log('PASS: PF2e and Project Moon full export/import/reopen, hidden pages, rich 4-column inventory, equipment, formatting and >50KB JSON');
