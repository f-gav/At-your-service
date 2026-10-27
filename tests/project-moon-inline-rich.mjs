import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyMoonSheet,readMoonSheet,saveMoonSheet,addMoonWeapon,removeMoonWeapon,
  removeMoonOutfit,removeMoonAugment} from '../src/features/project-moon/model.ts';
const src=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const inline=src('../src/features/project-moon/MoonInlineRichField.tsx');
const weapons=src('../src/features/project-moon/ProjectMoonSheet.tsx');
const equipment=src('../src/features/project-moon/MoonEquipmentPage.tsx');
const css=src('../src/features/project-moon/ProjectMoonSheet.css');
const richEditor=src('../src/features/pathfinder/RichField.tsx');

// Rich decoration never replaces raw mechanical strings, including the dice formula.
const initial=emptyMoonSheet();
initial.weapons[0].dice='1к11';
initial.outfits[0].block='1d10+1';
initial.augments[0].location='Левая рука';
initial.inlineFormatting['weapon:weapon-1:dice']='ays:rich:v1:<div><strong>1к11</strong></div>';
initial.inlineFormatting['outfit:outfit-1:block']='ays:rich:v1:<div><em>1d10+1</em></div>';
initial.inlineFormatting['augment:augment-1:location']='ays:rich:v1:<div><u>Левая рука</u></div>';
const parsed=readMoonSheet(saveMoonSheet({},initial));
assert.equal(parsed.weapons[0].dice,'1к11');
assert.equal(parsed.outfits[0].block,'1d10+1');
assert.equal(parsed.augments[0].location,'Левая рука');
assert.deepEqual(parsed.inlineFormatting,initial.inlineFormatting);
assert.deepEqual(readMoonSheet({}).inlineFormatting,{});
assert.deepEqual(readMoonSheet({projectMoonSheet:{inlineFormatting:{good:'ays:rich:v1:<b>Ok</b>',bad:23}}})
  .inlineFormatting,{good:'ays:rich:v1:<b>Ok</b>'});

// Removing a card deletes only that card's rich map entries.
const withWeapon=addMoonWeapon(parsed,'weapon-extra');
withWeapon.inlineFormatting['weapon:weapon-extra:dice']='ays:rich:v1:<b>2d6</b>';
const removedWeapon=removeMoonWeapon(withWeapon,'weapon-extra');
assert.equal(removedWeapon.inlineFormatting['weapon:weapon-extra:dice'],undefined);
assert.equal(removedWeapon.inlineFormatting['weapon:weapon-1:dice'],initial.inlineFormatting['weapon:weapon-1:dice']);
const removedOutfit=removeMoonOutfit(removedWeapon,'outfit-1');
assert.equal(removedOutfit.inlineFormatting['outfit:outfit-1:block'],undefined);
const removedAugment=removeMoonAugment(removedOutfit,'augment-1');
assert.equal(removedAugment.inlineFormatting['augment:augment-1:location'],undefined);
assert.equal(removedAugment.inlineFormatting['weapon:weapon-1:dice'],initial.inlineFormatting['weapon:weapon-1:dice']);

// All short rich fields reuse the battle-tested editor with selection toolbar,
// preserved selection range, HTML allowlist, and clickable dice-chip binding.
for(const part of ['dice','form','grip','bonus']){
  assert.match(weapons,new RegExp("updateWeaponRich\\(weapon.id,'"+part+"'"));
}
for(const part of ['block','evade']){
  assert.match(equipment,new RegExp("updateOutfitRich\\(item.id,'"+part+"'"));
}
for(const part of ['location','description']){
  assert.match(equipment,new RegExp("updateAugmentRich\\(item.id,'"+part+"'"));
}
assert.match(inline,/moonInlinePlain\(rich\)/);
assert.match(inline,/onChange\(moonInlinePlain\(rich\),rich\)/);
assert.match(inline,/resourceContext=\{resourceContext\}/);
assert.match(richEditor,/aria-label="Форматирование выделенного текста"/);
assert.match(richEditor,/aria-label="Формула кубиков"/);
assert.match(richEditor,/serializeRichHtml/);
assert.match(equipment,/resourceContext=\{sheet.fields\}/);
assert.match(css,/\.moon-paper \.moon-inline-rich-wrap/);
assert.match(css,/\.moon-equipment-fields \.moon-inline-rich/);
console.log('PASS: Project Moon inline rich editing, dice binding, legacy plain values, persistence and card lifecycle');
