import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyMoonSheet, readMoonSheet, saveMoonSheet, moonSubtitle, moonCalculatedMax,
  moonDisplayedMax, moonAttackBonus, moonDamageEstimate, moonResistanceMultiplier, addMoonSkill, MOON_PAGES, MOON_ATTRIBUTES,
} from '../src/features/project-moon/model.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const blank = emptyMoonSheet();
assert.equal(MOON_PAGES.length, 4);
assert.equal(MOON_ATTRIBUTES.length, 6);
assert.equal(blank.weapons.length, 2);
assert.equal(blank.skills.length, 6);
assert.equal(blank.notes.length, 6);
assert.equal(blank.fields.rank, undefined);
assert.equal(moonDisplayedMax(blank, 'light'), '');
assert.equal(moonDisplayedMax(blank, 'hp'), '');
assert.equal(moonAttackBonus(blank), '');

blank.fields.rank = '1';
assert.equal(moonDisplayedMax(blank, 'light'), '4');
assert.equal(moonAttackBonus(blank), '+1');
blank.fields.fortitude = '3';
blank.fields.charm = '2';
blank.fields.prudence = '4';
assert.equal(moonCalculatedMax(blank, 'hp'), null);
blank.autoVitals = true;
assert.equal(moonDisplayedMax(blank, 'hp'), '120');
assert.equal(moonDisplayedMax(blank, 'st'), '32');
assert.equal(moonDisplayedMax(blank, 'sp'), '27');
blank.maxOverrides.hp = '177';
blank.maxOverrides.light = '8';
assert.equal(moonDisplayedMax(blank, 'hp'), '177');
assert.equal(moonDisplayedMax(blank, 'light'), '8');
blank.fields.rank = '2';
assert.equal(moonDisplayedMax(blank, 'light'), '8');
assert.equal(moonDisplayedMax(blank, 'st'), '36');
delete blank.maxOverrides.light;
assert.equal(moonDisplayedMax(blank, 'light'), '5');
assert.equal(addMoonSkill(blank, 'skill-extra').skills.length, 7);
assert.equal(blank.skills.length, 6);
blank.fields.occupation = 'Фиксер';
blank.fields.organization = 'Ассоциация';
const details = saveMoonSheet({ notes: 'Keep', pathfinderSheet: { preserved: true } }, blank);
assert.equal(details.notes, 'Keep');
assert.equal(details.pathfinderSheet.preserved, true);
assert.equal(moonSubtitle(details), 'Фиксер · Ассоциация');
assert.equal(readMoonSheet(details).skills.length, 6);
assert.equal(readMoonSheet({}).notes.length, 6);
assert.deepEqual(readMoonSheet({projectMoonSheet:{fields:{rank:'1',bad:23}}}).fields, {rank:'1'});

// 0.3.2: formula assistance stays optional; persisted manual fields take precedence.
const legacyAttack=readMoonSheet({projectMoonSheet:{fields:{rank:'3',attackBonus:'+7'}}});
assert.equal(legacyAttack.fields.attackBonus,'+7');
assert.equal(moonAttackBonus(legacyAttack),'+3');
assert.equal(readMoonSheet(saveMoonSheet({},legacyAttack)).fields.attackBonus,'+7');
for(const [raw,expected] of [['Fatal',2],['Weak',1.5],['Normal',1],['Endured',.5],['Ineffective',.25],['Immune',0],['x1.5',1.5],['×0,5',.5]]) {
  assert.equal(moonResistanceMultiplier(raw),expected,'resistance '+raw);
}
assert.equal(moonResistanceMultiplier('<script>'),null);
assert.equal(moonDamageEstimate('12','Weak'),18);
assert.equal(moonDamageEstimate('12','Endured','2'),8);
assert.equal(moonDamageEstimate('12','Normal','-2'),10);
assert.equal(moonDamageEstimate('12','Immune'),0);
assert.equal(moonDamageEstimate('12',''),null);
assert.equal(moonDamageEstimate('oops','Normal'),null);
assert.equal(moonDamageEstimate('12','Normal','bad'),null);
assert.equal(moonDamageEstimate('12','Normal','-100'),0);
const many=emptyMoonSheet();for(let i=6;i<40;i++)many.skills.push({id:'skill-'+i,title:'П'+i,body:'Текст'});
assert.equal(readMoonSheet(saveMoonSheet({},many)).skills.length,40);
assert.equal(readMoonSheet(saveMoonSheet({},many)).skills[37].body,'Текст');

const app = read('../src/App.tsx');
const sql = read('../supabase/migrations/20261012_add_project_moon_system.sql');
const sheet = read('../src/features/project-moon/ProjectMoonSheet.tsx');
assert.ok(app.includes("active.system === 'prmoon'"));
assert.ok(app.includes("createPanel === 'prmoon'"));
assert.ok(app.includes("'PR. MOON'"));
assert.ok(sql.includes("'prmoon'"));
assert.ok(sheet.includes("pageOrder.map(page => <article"));
assert.ok(sheet.includes("addMoonSkill"));
assert.ok(sheet.includes("Автоматический подсчёт HP / ST / SP"));
assert.ok(sheet.includes("RichField"));
assert.ok(sheet.includes("sheet.fields.attackBonus ?? ''"),'Attack bonus must use manual persisted field');
assert.ok(sheet.includes("onChange={event=>change('attackBonus',event.target.value)}"));
assert.ok(sheet.includes('moonDamageEstimate('),'Calculator should invoke pure preview helper');
assert.ok(sheet.includes('damageCalculatorOpen'),'Optional calculator must start closed');
assert.ok(sheet.includes('Подсказки не изменяют ресурсы'),'States must remain manual');
assert.ok(sheet.includes('old.skills.length >= 100'),'Technical safety cap must not silently drop skills');

console.log('PASS: Project Moon starter sheet, optional resources, Light, cards, persistence and integration');
