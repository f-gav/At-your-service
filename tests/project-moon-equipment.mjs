import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  emptyMoonSheet,readMoonSheet,saveMoonSheet,
  addMoonOutfit,removeMoonOutfit,updateMoonOutfit,
  addMoonAugment,removeMoonAugment,updateMoonAugment,
  moonAugmentEpSummary,
} from '../src/features/project-moon/model.ts';
import {parseMoonOrder} from '../src/features/project-moon/page-order.ts';
import {MOON_AUGMENT_TYPES,moonAugmentTypeLabel,moonAugmentTypeValue} from '../src/features/project-moon/augment-types.ts';
import {exportPagePlan} from '../src/lib/sheet-pdf.ts';
const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');

for(const [saved,label] of [
  ['Combat Part','Боевой компонент'],
  ['Specialized Part','Специализированный компонент'],
  ['Functional Part','Функциональный компонент'],
]){
  assert.equal(moonAugmentTypeLabel(saved),label,'Existing English types must display in Russian');
  assert.equal(moonAugmentTypeValue(label),saved,'Russian input must retain canonical saved values');
}
assert.deepEqual(MOON_AUGMENT_TYPES.map(type=>type.label),[
  'Биологический','Протез','Боевой компонент',
  'Специализированный компонент','Функциональный компонент','Иной',
]);
assert.equal(moonAugmentTypeLabel('Собственный тип'),'Собственный тип');
assert.equal(moonAugmentTypeValue('Собственный тип'),'Собственный тип');
const oldAugment=readMoonSheet({projectMoonSheet:{augments:[{id:'augment-1',name:'Старый',category:'Combat Part'}]}});
assert.equal(moonAugmentTypeLabel(oldAugment.augments[0].category),'Боевой компонент');
assert.equal(saveMoonSheet({},oldAugment).projectMoonSheet.augments[0].category,'Combat Part');
assert.match(source('../src/features/project-moon/MoonEquipmentPage.tsx'),/moonAugmentTypeLabel\(item.category\)/);
assert.match(source('../src/features/project-moon/MoonEquipmentPage.tsx'),/moonAugmentTypeValue\(e.target.value\)/);
const empty=emptyMoonSheet();
assert.equal(empty.outfits.length,2);
assert.equal(empty.augments.length,2);
assert.equal(empty.equippedOutfitId,'');
assert.deepEqual(empty.pageOrder,['dossier','combat','equipment','about','notes']);
const legacy=readMoonSheet({projectMoonSheet:{
  pageOrder:['dossier','combat','about','notes'],
  weapons:[{id:'legacy-weapon',name:'Меч'}],fields:{resistanceHpSlash:'×0.5'},
  notes:[{title:'Память',body:'Нельзя удалять'}],
}});
assert.equal(legacy.outfits.length,2);
assert.equal(legacy.augments.length,2);
assert.deepEqual(legacy.pageOrder,['dossier','combat','equipment','about','notes']);
assert.equal(legacy.fields.resistanceHpSlash,'×0.5');
assert.equal(legacy.weapons[0].name,'Меч');
assert.equal(legacy.notes[0].body,'Нельзя удалять');
assert.deepEqual(parseMoonOrder(['notes','combat','about','dossier']),
  ['notes','combat','equipment','about','dossier']);

let edited=updateMoonOutfit(empty,'outfit-2',{
  name:'Алый плащ',rank:'3',ep:'4',property:'Balanced',
  block:'1d10+2',evade:'1d12+2',hpSlash:'×0.5',stBlunt:'×1.5',
  effects:'ays:rich:v1:<p>Важные свойства</p>',
});
edited={...edited,equippedOutfitId:'outfit-2',fields:{...edited.fields,rank:'3'}};
edited=addMoonOutfit(edited,'outfit-3');
edited=updateMoonOutfit(edited,'outfit-3',{name:'Лёгкий костюм'});
edited=updateMoonAugment(edited,'augment-1',{
  name:'Механический глаз',category:'Functional Part',positiveEp:'3',
  negativeEp:'1',effects:'ays:rich:v1:<b>Точное зрение</b>',
  drawbacks:'ays:rich:v1:<b>Перегрузка</b>',
});
edited=addMoonAugment(edited,'augment-3');
edited=updateMoonAugment(edited,'augment-3',{
  name:'Протез',location:'Рука',positiveEp:'2',
});
assert.deepEqual(moonAugmentEpSummary(edited),{
  base:12,spent:5,gained:1,remaining:8,
});
assert.equal(moonAugmentEpSummary(empty).base,null);
let deleted=removeMoonOutfit(edited,'outfit-2');
assert.equal(deleted.equippedOutfitId,'');
assert.deepEqual(deleted.outfits.map(x=>x.name),['','Лёгкий костюм']);
assert.strictEqual(updateMoonOutfit(deleted,'outfit-2',{name:'Поздний ввод'}),deleted);
deleted=removeMoonAugment(deleted,'augment-1');
assert.deepEqual(deleted.augments.map(x=>x.name),['','Протез']);
assert.strictEqual(updateMoonAugment(deleted,'augment-1',{name:'Поздний ввод'}),deleted);
assert.strictEqual(removeMoonOutfit({...empty,outfits:[empty.outfits[0]]},empty.outfits[0].id).outfits.length,1);
assert.strictEqual(removeMoonAugment({...empty,augments:[empty.augments[0]]},empty.augments[0].id).augments.length,1);
const saved=saveMoonSheet({otherSystem:{keep:true},projectMoonSheet:{futureRules:{untouched:true}}},edited);
const parsed=readMoonSheet(JSON.parse(JSON.stringify(saved)));
assert.equal(parsed.outfits[1].name,'Алый плащ');
assert.equal(parsed.outfits[1].effects,edited.outfits[1].effects);
assert.equal(parsed.outfits[1].hpSlash,'×0.5');
assert.equal(parsed.outfits[1].stBlunt,'×1.5');
assert.equal(parsed.equippedOutfitId,'outfit-2');
assert.equal(parsed.augments[0].drawbacks,edited.augments[0].drawbacks);
assert.deepEqual(saved.otherSystem,{keep:true});
assert.deepEqual(saved.projectMoonSheet.futureRules,{untouched:true});
assert.equal(readMoonSheet({projectMoonSheet:{outfits:[{name:'Без ID'}],augments:[{name:'Без ID'}]}}).outfits[0].id,'outfit-1');
assert.equal(readMoonSheet({projectMoonSheet:{outfits:[{name:'Без ID'}],augments:[{name:'Без ID'}]}}).augments[0].id,'augment-1');
const flood=Array.from({length:110},(_,i)=>({...empty.outfits[0],id:'outfit-'+i}));
assert.equal(readMoonSheet({projectMoonSheet:{outfits:flood}}).outfits.length,100);
assert.strictEqual(addMoonOutfit({...empty,outfits:flood},'overflow').outfits.length,110);
assert.deepEqual(exportPagePlan('prmoon',5,2,6,6,7),{
  basePages:6,extraWeapons:0,extraSkills:0,extraOutfits:4,extraAugments:5,extraPages:3,
});
const sheet=source('../src/features/project-moon/ProjectMoonSheet.tsx');
const page=source('../src/features/project-moon/MoonEquipmentPage.tsx');
const pdf=source('../src/lib/sheet-pdf.ts');
assert.match(sheet,/page === 'equipment'/);
assert.match(page,/moon-'\+kind\+'-card/);
assert.match(page,/kind="augment"/);
assert.match(page,/MoonWeaponDeleteDialog/);
assert.match(page,/inert=\{index<offset/);
assert.match(pdf,/prepareMoonEquipment/);
assert.match(pdf,/Дополнительная броня/);
assert.match(pdf,/Дополнительные аугменты/);
console.log('PASS: equipment page, stable card data, equipped choice, EP guidance, legacy restore and PDF overflow');
