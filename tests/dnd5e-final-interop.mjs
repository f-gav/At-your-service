import assert from 'node:assert/strict';
import {newDndSheet} from '../src/features/dnd5e/domain/model.ts';
import {validateDndSheet,changeDndLayout} from '../src/features/dnd5e/domain/validation.ts';
import {build} from 'esbuild';
// Production JSON codec uses Vite extensionless imports; bundle the actual
// source instead of rewriting it for Node tests. No real Supabase connection.
const compiled=await build({
  entryPoints:['src/lib/character-json.ts'],bundle:true,write:false,platform:'node',format:'esm',
  plugins:[{name:'no-live-network',setup(builder){
    builder.onResolve({filter:/\/lib\/supabase$/},()=>({path:'stub',namespace:'ci-stub'}));
    builder.onLoad({filter:/.*/,namespace:'ci-stub'},()=>({
      contents:'export const supabase=null;',loader:'js'
    }));
  }}],
});
const {parseCharacterJson,exportCharacter}=await import('data:text/javascript;base64,'+
  Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
import {parseLssCharacter,exportOriginalLssJson} from '../src/features/dnd5e/infra/lss-import.ts';
import {prepareDndDetails} from '../src/features/dnd5e/infra/transfer.ts';
import {dndPdfEntries,dndPdfSupplementPlan,splitPdfText,printableRichText} from '../src/features/dnd5e/infra/pdf-plan.ts';

function char(name,sheet){return {
  id:'offline-character',user_id:'offline-user',name,system:'dnd5e',
  details:{notes:'Сохрани меня!',dnd5eSheet:sheet},sort_order:1,
  portrait_card_path:null,portrait_sheet_path:null,portrait_source_path:null,portrait_crops:null,
  created_at:'',updated_at:'',
};}
const long='🎲Заметка & <важно> с текстом. '.repeat(500);
assert.equal(splitPdfText(long).join(''),long,'PDF chunks must reconstruct complete Unicode input');
assert.ok(splitPdfText(long).length>40);
assert.equal(printableRichText('ays:rich:v1:<p><strong>Сила</strong> и <em>воля</em></p>'),'Сила и воля');
for(const edition of ['2014','2024']){
  const sheet=newDndSheet('Герой-'+edition,edition);
  sheet.content.blocks.note1='ays:rich:v1:<p><b>Победа</b> будет!</p>';
  sheet.content.blocks.note2=long.slice(0,21500);
  sheet.content.blocks.note3='Проверка';
  sheet.spellcasting.spells=[{id:'h',name:'Лечение',level:1,source:'homebrew',
    notes:'Длинное описание <&> '+long.slice(0,300)}];
  sheet.features=[{id:'f',name:'Черта',source:'Персонаж',description:'Наследие'}];
  assert.equal(validateDndSheet(sheet).layoutEdition,edition);
  const pdf=dndPdfSupplementPlan(sheet);
  const key=pdf.find(row=>row.label==='Текстовое поле: note2');
  assert.equal(key.parts.join(''),sheet.content.blocks.note2);
  assert.equal(pdf.find(row=>row.label==='Текстовое поле: note1').parts.join(''),'Победа будет!');
  assert.ok(dndPdfEntries(sheet).some(row=>row.label.includes('Заклинание')));
  assert.deepEqual(changeDndLayout(changeDndLayout(sheet,edition==='2014'?'2024':'2014'),edition),
    sheet,'Changing paper twice must preserve every structure');
}
const LSS={
  jsonType:'character',version:'2',edition:'2024',sheetEdition:'2014',
  spells:{mode:'cards',prepared:['cure-wounds','guidance'],book:['cure-wounds'],
    granted:[],slotless:[]},
  disabledBlocks:{'info-left':[],'info-right':[],'subinfo-left':[],
    'subinfo-right':[],'notes-left':[],'notes-right':[]},
  data:JSON.stringify({
    name:{value:'Рейна'},
    info:{charClass:{value:'Жрец'},level:{value:5},background:{value:'Странник'}},
    stats:{str:{score:{value:12}},dex:{score:{value:14}},wis:{score:{value:18}}},
    coins:{gp:{value:42},sp:{value:11}},
    conditions:{value:['poisoned']},exhaustion:{value:1},inspiration:{value:true},
    text:{notes1:{value:{data:{type:'doc',content:[{type:'paragraph',content:[
      {type:'text',text:'Благословенный',marks:[{type:'bold'}]},
      {type:'text',text:' герой'}]}]}}},notes2:{value:'Вторая заметка'}},
    bonuses:[{id:'lss-effect',target:'attack.all',mode:'add',expr:'1d4',
      source:{kind:'effect',refId:'buff',label:'Благословение'}}],
  }),
};
const fromString=parseCharacterJson(JSON.stringify(LSS));
assert.equal(fromString.system,'dnd5e');
assert.equal(fromString.name,'Рейна');
const sheet=fromString.details.dnd5eSheet;
assert.equal(sheet.rulesEdition,'2024');
assert.equal(sheet.layoutEdition,'2014');
assert.equal(sheet.abilities.wis.score,18);
assert.equal(sheet.inventory.coins.gp,42);
assert.equal(sheet.spellcasting.spells.length,2);
assert.equal(sheet.spellcasting.spells.find(s=>s.name==='cure-wounds').prepared,true);
assert.equal(sheet.spellcasting.spells.find(s=>s.name==='cure-wounds').inBook,true);
assert.match(sheet.content.blocks.note1,/strong>Благословенный/);
assert.equal(sheet.content.blocks.note2,'Вторая заметка');
assert.ok(sheet.imports.unmapped.lssOriginal);
assert.deepEqual(JSON.parse(exportOriginalLssJson(sheet)),LSS,'Original LSS must be archived unmodified');
assert.ok(parseLssCharacter(LSS).warnings.some(w=>w.includes('Бонусы')));
assert.ok(sheet.imports.unmapped.lssWarnings.some(w=>w.includes('Бонусы')),
  'Unmapped LSS mechanics must be reported in persistent UI-visible metadata');
const exported=exportCharacter(char('Рейна',sheet));
const imported=parseCharacterJson(JSON.stringify(exported));
assert.deepEqual(imported.details.dnd5eSheet,sheet);
assert.equal(imported.details.notes,'Сохрани меня!');
assert.deepEqual(changeDndLayout(sheet,'2024').imports.unmapped.lssOriginal,sheet.imports.unmapped.lssOriginal);
assert.throws(()=>parseLssCharacter({...LSS,version:'1'}),/версии 2/);
assert.throws(()=>parseLssCharacter({...LSS,edition:'2030'}),/версии 2/);
assert.throws(()=>parseLssCharacter({...LSS,data:'{bad'}),/JSON-строку/);
assert.throws(()=>parseLssCharacter({...LSS,data:'[]'}),/объектом/);
assert.throws(()=>parseLssCharacter({...LSS,data:'x'.repeat(2e6)}),/1,5 МБ/);
const malicious={...LSS,data:JSON.stringify({
  name:{value:'Наследник'},text:{notes1:{value:{data:{
    type:'doc',content:[{type:'paragraph',content:[{type:'text',
      text:'<img onerror=alert(1)> & безопасно'}]}]
  }}}}
})};
const secured=parseLssCharacter(malicious);
assert.ok(!secured.details.dnd5eSheet.content.blocks['note1'].includes('<img '),
  'LSS prose cannot inject executable HTML');
assert.ok(secured.details.dnd5eSheet.content.blocks.note1.includes('&lt;img '));
const giant=newDndSheet('Очень большой персонаж','2024');
giant.content.blocks.note1='A'.repeat(21000);
giant.content.blocks.note2='B'.repeat(21000);
giant.content.blocks.note3='C'.repeat(21000);
const largeExport=exportCharacter(char('Большой',giant));
assert.equal(largeExport.character.sheet.content.blocks.note3.length,21000,
  'Oversized sheets MUST remain fully exportable to local JSON');
assert.throws(()=>prepareDndDetails({},giant),/безопасный предел/);
assert.throws(()=>parseCharacterJson(JSON.stringify(largeExport)),/безопасный предел/,
  'Database-sized import should fail explicitly, without partial writes');
console.log('PASS: D&D final LSS v2 envelope/ProseMirror, safe source archive, JSON roundtrip, oversized backup and PDF text plan');
