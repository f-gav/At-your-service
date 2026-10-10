import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBardDemo } from '../src/features/pathfinder/bard-demo.ts';

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const fields = JSON.parse(read('../src/features/pathfinder/fields.json'));
const extra = [
  {id:'shield_ac_bonus',page:1,kind:'number',label:'Щит — числовое поле'},
  {id:'custom_qa_numeric',page:2,kind:'counter',label:'Пользовательское число'},
  {id:'custom_qa_text',page:3,kind:'text',label:'Пользовательский текст',maxlen:12},
  {id:'custom_qa_long',page:3,kind:'long',label:'Заметки'},
  {id:'custom_qa_toggle',page:4,kind:'toggle',label:'Отметка'},
  {id:'custom_qa_select',page:4,kind:'select',label:'Выбор',options:['Выбор А','Выбор Б']},
];
const complete = [...fields.filter(f=>f.id!=='size'), {...fields.find(f=>f.id==='size'),kind:'select',options:['Маленький','Средний','Большой']},...extra];
const demo = buildBardDemo(complete);

assert.deepEqual(Object.keys(demo).sort(), complete.map(f=>f.id).sort());
assert.deepEqual(buildBardDemo(complete),demo,'Fixture must be deterministic');
assert.ok(complete.every(f=>demo[f.id]!==''),'Every PDF field, including custom fields, must be filled');
assert.equal(demo.name,'Лираэль');
assert.equal(demo.character_class,'Бард');
assert.equal(demo.ancestry,'Человек');
assert.equal(demo.level,'20');
assert.equal(demo.size,'Средний');
assert.equal(demo.armor_class,'42');
assert.equal(Number(demo.armor_class),10+Number(demo.armor_dex)+Number(demo.armor_prof)+Number(demo.armor_item));
assert.equal(demo.shield_ac_bonus,'+2');
assert.equal(demo.tradition_occult,'true');
assert.equal(demo.tradition_arcane,'false');
assert.equal(demo.spontaneous,'true');
assert.equal(demo.prepared,'false');
assert.equal(demo.hero_1,'true');
assert.equal(demo.hero_2,'false');
assert.equal(demo.weapon_1_name,'Рапира +3');
assert.equal(demo.spell_slots_10,'1');
assert.equal(demo.spell_remaining_10,'1');
assert.match(demo.spellbook_left_names,/Невидимость/);
assert.match(demo.inventory_held,/Лютня/);
assert.match(demo.campaign_notes,/День 12/);
assert.ok(demo.custom_qa_text.length<=12);
assert.equal(demo.custom_qa_select,'Выбор А');
assert.ok([1,2,3,4].every(page => complete.some(f=>f.page===page && demo[f.id])));

for(const field of complete) {
  const value = demo[field.id];
  if(field.kind==='toggle')assert.ok(value==='true'||value==='false',field.id+' must be boolean text');
  if(field.kind==='select')assert.ok(field.options.includes(value),field.id+' must use a configured option');
  if((field.kind==='number'||field.kind==='counter')&&!/^weapon_[1-5]_damage$/.test(field.id))
    assert.match(value,/^[+-]?\d+$/,field.id+' must preview a number');
}
const admin=read('../src/features/pathfinder/TemplateAdmin.tsx');
assert.match(admin,/buildBardDemo\(fields\)/);
assert.match(admin,/Тест персонажа/);
assert.match(admin,/Скрыть тест/);
assert.match(admin,/aria-pressed=\{bardTestOn\}/);
assert.match(admin,/displaySamples/);
assert.match(admin,/setBardOverrides\(\{\}\)/);
assert.match(admin,/bardTestOn\s*\?\s*\{\.\.\.samples,\.\.\.bardSamples,\.\.\.bardOverrides\}\s*:\s*samples/);
const savePart=admin.slice(admin.indexOf('async function save()'),admin.indexOf('async function loadVersion()'));
assert.doesNotMatch(savePart,/bardTestOn|bardOverrides|bardSamples|displaySamples/,'No preview fixtures in Supabase writes');
const css=read('../src/features/pathfinder/TemplateAdmin.css');
assert.match(css,/\.ta-controls \.ta-bard-test/);
console.log('PF2e Bard QA: all four pages, all field kinds, toggle-off preserves local previews, not persisted.');
