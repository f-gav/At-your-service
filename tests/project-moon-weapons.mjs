import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyMoonSheet, readMoonSheet, saveMoonSheet, addMoonWeapon, removeMoonWeapon,
  moonWeaponLetter,
} from '../src/features/project-moon/model.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const original = emptyMoonSheet();
assert.equal(original.weapons.length, 2);
assert.equal(original.smoothWeaponSwitch, true);
assert.equal(moonWeaponLetter(0), 'A');
assert.equal(moonWeaponLetter(1), 'B');
assert.equal(moonWeaponLetter(2), 'C');
assert.equal(moonWeaponLetter(25), 'Z');
assert.equal(moonWeaponLetter(26), 'AA');
assert.equal(moonWeaponLetter(27), 'AB');

const older = readMoonSheet({projectMoonSheet: {
  weapons: [{id:'weapon-A',name:'Старая катана',dice:'1d10',bonus:'+2',description:'Сохранить описание'},
            {id:'weapon-B',name:'Револьвер',dice:'1d8',bonus:'+1',description:'Сохранить эффекты'}],
}});
assert.equal(older.smoothWeaponSwitch, true);
assert.equal(older.weapons.length, 2);
assert.equal(older.weapons[0].name,'Старая катана');
let newer = addMoonWeapon(older,'weapon-C');
newer.weapons[2].name='Третье оружие';
newer.weapons[2].damage='Slash';
newer = addMoonWeapon(newer,'weapon-D');
newer.weapons[3].name='Четвёртое оружие';
newer.smoothWeaponSwitch=false;
const saved = saveMoonSheet({pathfinderSheet:{unchanged:true}},newer);
const reloaded=readMoonSheet(saved);
assert.equal(reloaded.weapons.length,4);
assert.equal(reloaded.weapons[0].name,'Старая катана');
assert.equal(reloaded.weapons[1].name,'Револьвер');
assert.equal(reloaded.weapons[2].name,'Третье оружие');
assert.equal(reloaded.weapons[2].damage,'Slash');
assert.equal(reloaded.weapons[3].name,'Четвёртое оружие');
assert.equal(reloaded.smoothWeaponSwitch,false);
const deleted = removeMoonWeapon(reloaded, 'weapon-D');
assert.equal(deleted.weapons.length,3);
assert.equal(deleted.weapons[2].name,'Третье оружие');
const next = removeMoonWeapon(deleted,'weapon-C');
assert.equal(next.weapons.length,2);
assert.equal(next.weapons[0].name,'Старая катана');
assert.equal(next.weapons[1].name,'Револьвер');
assert.strictEqual(removeMoonWeapon(next,'weapon-A'),next); // cannot drop below two slots
assert.strictEqual(removeMoonWeapon(reloaded,'nonexistent'),reloaded);
assert.equal(readMoonSheet(saveMoonSheet({},deleted)).weapons.length,3);
assert.equal(saved.pathfinderSheet.unchanged,true);

const sheet = read('../src/features/project-moon/ProjectMoonSheet.tsx');
const css = read('../src/features/project-moon/ProjectMoonSheet.css');
const globalCSS = read('../src/styles.css');
assert.ok(sheet.includes('Плавная анимация переключения'));
assert.ok(sheet.includes("checked={sheet.smoothWeaponSwitch}"));
assert.ok(sheet.includes('addMoonWeapon(old,'));
assert.ok(sheet.includes('moonWeaponLetter(index)'));
assert.ok(sheet.includes('aria-label="Предыдущее оружие"'));
assert.ok(sheet.includes('aria-label="Следующее оружие"'));
assert.ok(sheet.includes('className="moon-weapon-title"'));
assert.ok(sheet.includes('className="moon-weapon-carousel"'));
assert.ok(sheet.includes('className="moon-delete-weapon"'));
assert.ok(sheet.includes('className="moon-delete-weapon-mobile"'));
assert.ok(sheet.includes('aria-label={\'Удалить оружие \' + moonWeaponLetter(index)}'));
assert.ok(sheet.includes('window.confirm('));
assert.ok(sheet.includes('removeMoonWeapon(old, id)'));
assert.ok(sheet.includes("weaponViewportRef.current"));
assert.ok(sheet.includes("behavior: sheet.smoothWeaponSwitch && !reducedMotion ? 'smooth' : 'instant'"));
assert.ok(sheet.includes("inert={index < weaponOffset"));
assert.ok(sheet.includes("updateWeaponById(weapon.id,{name:event.target.value})"));
const weaponSection = sheet.slice(sheet.indexOf('className="moon-weapon-carousel"'), sheet.indexOf("sectionTitle(3, 'Сопротивления"));
assert.ok(!weaponSection.includes('<strong>Название:</strong>')); // The skill cards retain their own name field.
assert.ok(css.includes('.moon-weapon-track > .moon-weapon-card'));
assert.ok(css.includes('flex:0 0 calc((100% - 12px) / 2)'));
assert.ok(css.includes('scroll-snap-type:x mandatory'));
assert.ok(css.includes('.moon-weapon-pagination'));
assert.ok(css.includes('.moon-weapon-heading .moon-delete-weapon'));
assert.ok(css.includes('.moon-delete-weapon-mobile'));
assert.ok(css.includes('prefers-reduced-motion') || sheet.includes('prefers-reduced-motion'));
assert.ok(globalCSS.includes(".character-prmoon .character-system { color: #29445f; }"));
const prMoonFont = globalCSS.match(/\.character-prmoon \.character-system \{\s*font-family: ([^;]+);/);
assert.ok(prMoonFont,'Pr. Moon uses its own complete cursive font');
assert.ok(prMoonFont[1].includes('Lobster'));
assert.ok(!prMoonFont[1].includes('Tilda Script'));
console.log('PASS: Pr. Moon weapon carousel, persistent unlimited slots, settings and full Latin badge font');
