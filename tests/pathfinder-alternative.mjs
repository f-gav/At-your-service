import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const original=initialSheetValues({pathfinderSheet:{name:'Герой',level:'5',ability_int:'+4',spell_dc:'24',pf2e_layout:'classic',pf_spell_library_selection:'[{"id":"spell","prepared":true}]'}},'Герой');
const changed=initialSheetValues(persistSheetValues({pathfinderSheet:original},{...original,pf2e_layout:'alternative'},'Герой'),'Герой');
assert.equal(changed.pf2e_layout,'alternative');
for(const key of ['level','ability_int','spell_dc','pf_spell_library_selection'])assert.equal(changed[key],original[key]);
const app=read('../src/App.tsx'),sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const html=read('../src/features/pathfinder/AlternativePathfinderPages.tsx');
for(const label of ['Альтернативный PF2e','Классический PF2e'])assert.ok(app.includes(label)||sheet.includes(label));
for(const marker of ['page===1','page===2','page===3','page===4',"page==='notes'",'RichField'])assert.ok(html.includes(marker),marker);
assert.ok(app.includes('pendingImport&&'));
assert.ok(read('../src/lib/sheet-pdf.ts').includes("'.pf-alt-stack > .pf-alt-page'"));

for(const heading of ['Класс брони и щит','Спасброски','Пункты здоровья',
  'Навыки','Удары','Черты народа и общие черты','Способности по уровням',
  'Инвентарь и снаряжение','Портрет персонажа','Действия и занятия',
  'Магическая традиция','Ячейки заклинаний','Фокусные заклинания',
  'Врождённые заклинания','Ритуалы']){
 assert.ok(html.includes(heading),'Missing original Russian PF2e section: '+heading);
}
for(const control of ['pf-alt-hero-marks','pf-alt-level-diamond',
 'pf-alt-tradition-wheel','pf-alt-dying-skulls','toggleDyingSkull',
 'pf-alt-coin','pf-alt-spell-columns-double']){
 assert.ok(html.includes(control)||read('../src/features/pathfinder/AlternativePathfinderPages.css').includes(control),
   'Missing visual/interactive PF2e element: '+control);
}
const printable=read('../src/lib/sheet-pdf.ts');
assert.ok(printable.includes("page.querySelectorAll('.pf-alt-add-spell,.pf-alt-portrait span')"),
  'HTML character PDF must not include editable controls');
assert.ok(html.includes("onOpenSpell(spell)"),
  'Printed spell rows must open their corresponding spell descriptions');
assert.ok(html.includes("onChange(key,values[key]!==true)"),
  'Magic traditions must remain synchronized with original PF2e fields');

assert.ok(html.includes("field('shield_ac_bonus'")&&html.includes("field('shield_hardness'"),
  'Shield bonus must be integrated into the printed defense block, not isolated at the foot');
assert.ok(!html.includes("||id==='class_dc_rank'"),
  'Class DC proficiency is a numeric bonus, not a zero-to-four proficiency dropdown');
assert.ok(html.includes('pf-alt-weapon-more'),
  'All supplementary weapon fields remain available in expandable form');
assert.ok(html.includes('pf-alt-manual-spells-double'),
  'Prepared/handwritten spells use two original-paper columns');
console.log('Alternative PF2e model, HTML pages and import flow checked.');
