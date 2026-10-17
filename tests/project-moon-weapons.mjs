import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyMoonSheet, readMoonSheet, saveMoonSheet, addMoonWeapon, removeMoonWeapon,
  updateMoonSkill, removeMoonSkill, moonOffsetAfterWeaponRemoval, moonWeaponLetter,
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

// Removing a middle skill must never retarget a delayed rich-text edit by index.
let combat=emptyMoonSheet();
combat.skills[0]={...combat.skills[0],title:'Первый',body:'A'};
combat.skills[1]={...combat.skills[1],title:'Средний',body:'B',ep:'4',light:'2'};
combat.skills[2]={...combat.skills[2],title:'Последний',body:'C'};
const deletedSkill=removeMoonSkill(combat,'skill-2');
assert.equal(deletedSkill.skills.length,5);
assert.deepEqual(deletedSkill.skills.slice(0,2).map(x=>x.body),['A','C']);
const updatedSkill=updateMoonSkill(deletedSkill,'skill-3',{body:'После удаления'});
assert.equal(updatedSkill.skills[1].body,'После удаления');
assert.equal(updatedSkill.skills[0].body,'A');
assert.strictEqual(updateMoonSkill(updatedSkill,'skill-2',{body:'Опоздавшее событие'}),updatedSkill);
assert.strictEqual(removeMoonSkill(updatedSkill,'skill-2'),updatedSkill);
assert.equal(readMoonSheet(saveMoonSheet({},updatedSkill)).skills[1].body,'После удаления');
// The weapons retain IDs and rich content when the middle card is removed.
const mid=removeMoonWeapon(reloaded,'weapon-C');
assert.deepEqual(mid.weapons.map(x=>x.id),['weapon-A','weapon-B','weapon-D']);
assert.deepEqual(mid.weapons.map(x=>x.name),['Старая катана','Револьвер','Четвёртое оружие']);
assert.equal(moonOffsetAfterWeaponRemoval(3,3,2),1);
assert.equal(moonOffsetAfterWeaponRemoval(2,2,2),0);
assert.equal(moonOffsetAfterWeaponRemoval(0,2,1),0);

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
assert.ok(sheet.includes('<MoonWeaponDeleteDialog'));
assert.ok(sheet.includes('pendingWeaponDelete'));
assert.ok(sheet.includes('pendingSkillDelete'),'Skill deletion must request confirmation');
assert.ok(sheet.includes('onConfirm={confirmSkillDeletion}'));
assert.ok(sheet.includes('kind="skill"'));
assert.ok(sheet.includes("updateMoonSkill(old, id, patch)"),'Skill editing must use stable card IDs');
assert.ok(sheet.includes("onClick={()=>setPendingSkillDelete(skill.id)}"));
assert.ok(!sheet.includes('skills:old.skills.filter(entry=>entry.id!==skill.id)'),'No immediate skill deletion');
assert.ok(sheet.includes('moonOffsetAfterWeaponRemoval('));

assert.ok(sheet.includes('setPendingWeaponDelete(id)'));
assert.ok(sheet.includes('onConfirm={confirmWeaponDeletion}'));
assert.ok(!sheet.includes('window.confirm('));

const confirmation = read('../src/features/project-moon/MoonWeaponDeleteDialog.tsx');
const pathfinderConfirmation = read('../src/features/pathfinder/DynamicAdvancement.tsx');
for (const marker of [
  'pf-advancement-confirm-backdrop',
  'pf-advancement-confirm',
  'pf-advancement-confirm-actions',
  'pf-advancement-confirm-delete',
  'role="dialog"',
  'aria-modal="true"',
  "event.key === 'Escape'",
  "event.key === 'Tab'",
  'createPortal(',
]) {
  assert.ok(confirmation.includes(marker), 'Project Moon confirmation missing '+marker);
  assert.ok(pathfinderConfirmation.includes(marker.replace('event.key', 'event.key')) ||
    ['createPortal(', "event.key === 'Escape'", "event.key === 'Tab'"].includes(marker),
    'PF2e reference confirmation does not have '+marker);
}
assert.ok(confirmation.includes('Отмена'));
assert.ok(confirmation.includes('Удалить'));
assert.ok(confirmation.includes('previouslyFocused?.focus()'));

assert.ok(sheet.includes('removeMoonWeapon(old, pendingWeaponDelete)'));
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
assert.ok(prMoonFont[1].includes('Tilda Script Moon'), 'Pr. Moon uses the supplied original Tilda Script font');
assert.ok(!prMoonFont[1].includes('Lobster'), 'Remove legacy external-font workaround');
console.log('PASS: Pr. Moon weapon carousel, persistent unlimited slots, settings and original Tilda Script badge font');
