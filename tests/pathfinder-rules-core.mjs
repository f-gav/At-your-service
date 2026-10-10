import assert from 'node:assert/strict';
import { readRank, readNumber, isLevel, proficiencyBonus, SKILL_ABILITIES, SAVE_ABILITIES,
  RANK_FIELDS, calculateCore, isAutomatic, isCoreComputedField } from '../src/features/pathfinder/rules-core.ts';
import { initialSheetValues, persistSheetValues } from '../src/features/pathfinder/sheet-values.ts';
import { readFileSync } from 'node:fs';

assert.equal(Object.keys(SKILL_ABILITIES).length, 18);
assert.equal(Object.keys(SAVE_ABILITIES).length, 3);
assert.equal(RANK_FIELDS.size, 33);
assert.equal(readRank('4'),4);
assert.equal(readRank('0'),0);
for(const invalid of ['5','-1','1.5','trained','',Infinity])assert.equal(readRank(invalid),undefined);
assert.equal(readNumber('+2'),2);
assert.equal(readNumber('-3'),-3);
assert.equal(readNumber('4 abc'),undefined);
assert.equal(isLevel('21'),undefined);
assert.equal(isLevel('1'),1);
assert.equal(proficiencyBonus(5,0),0);
assert.equal(proficiencyBonus(5,1),7);
assert.equal(proficiencyBonus(5,2),9);
assert.equal(proficiencyBonus(5,3),11);
assert.equal(proficiencyBonus(5,4),13);
const values={
 name:'Эллара', level:'1',
 ability_str:'0', ability_dex:'+3', ability_con:'1', ability_int:'0', ability_wis:'2', ability_cha:'4',
 skill_acrobatics_rank:'1', skill_acrobatics_item:'1',
 skill_athletics_rank:'0',
 skill_stealth_rank:'1', skill_stealth_armor:'-2',
 skill_lore1_rank:'1',
 save_fort_rank:'1', save_reflex_rank:'2', save_will_rank:'1',
 perception_rank:'1', perception_item:'1',
};
const computed=calculateCore(values);
assert.equal(computed.skill_acrobatics_ability,'+3');
assert.equal(computed.skill_acrobatics_prof,'+3');
assert.equal(computed.skill_acrobatics_total,'+7');
assert.equal(computed.skill_athletics_total,'0');
assert.equal(computed.skill_stealth_total,'+4'); // 3 Dex + 3 trained - 2 armor
assert.equal(computed.skill_lore1_total,'+3');
assert.equal(computed.save_fort,'+4');
assert.equal(computed.save_reflex,'+8');
assert.equal(computed.save_will,'+5');
assert.equal(computed.perception,'+6');
assert.equal(computed.perception_prof,'+3');
assert.equal(computed.perception_ability,'+2');
const leveling=calculateCore({...values,level:'5'});
assert.equal(leveling.skill_acrobatics_total,'+11');
assert.equal(leveling.skill_athletics_total,'0');
assert.equal(leveling.save_reflex,'+12');
const changedDex=calculateCore({...values,ability_dex:'+4'});
assert.equal(changedDex.skill_acrobatics_total,'+8');
assert.equal(changedDex.save_reflex,'+9');
const changedRank=calculateCore({...values,skill_acrobatics_rank:'3'});
assert.equal(changedRank.skill_acrobatics_total,'+11');
assert.equal(calculateCore({...values,ability_dex:''}).skill_acrobatics_total,undefined);
assert.equal(calculateCore({...values,level:'0'}).skill_acrobatics_total,undefined);
assert.ok(isCoreComputedField('skill_acrobatics_total'));
assert.ok(isCoreComputedField('save_will_prof'));
assert.ok(isCoreComputedField('perception_ability'));
assert.ok(!isCoreComputedField('skill_acrobatics_rank'));
assert.ok(!isCoreComputedField('ability_dex'));
assert.equal(isAutomatic(values,true),false);
assert.equal(isAutomatic(values,false),true);
assert.equal(isAutomatic({...values,rulesMode:'auto'},true),true);
assert.equal(isAutomatic({...values,rulesMode:'manual'},false),false);

// The existing JSON v1 stores field IDs and typed rank 0–4 unchanged;
// rulesMode opt-in must survive serialization without renaming legacy fields.
const details={notes:'Original notes', pathfinderSheet:{...values, rulesMode:'auto',custom_field:'Retain'}};
const reopened=initialSheetValues(details,'Эллара');
assert.equal(reopened.rulesMode,'auto');
const saved=persistSheetValues(details,{...reopened,...computed},'Эллара');
const transported=JSON.parse(JSON.stringify({format:'at-your-service-character',system:'Pathfinder',version:1,character:{name:'Эллара',details:saved}}));
const restored=initialSheetValues(transported.character.details,transported.character.name);
assert.equal(restored.skill_acrobatics_total,'+7');
assert.equal(restored.skill_acrobatics_rank,'1');
assert.equal(restored.rulesMode,'auto');
assert.equal(restored.custom_field,'Retain');
assert.equal(calculateCore(restored).skill_acrobatics_total,'+7');

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const ui=read('../src/features/pathfinder/PathfinderSheet.tsx');
const rank=read('../src/features/pathfinder/RankSelect.tsx');
const css=read('../src/features/pathfinder/PathfinderSheet.css');
assert.match(ui,/calculateCore\(values\)/);
assert.match(ui,/setAutomatic/);
assert.match(ui,/RANK_FIELDS.has\(field.id\)/);
assert.match(ui,/persistSheetValues\(character.details, toStore, cleanName\)/);
assert.match(ui,/readOnly: computedField/);
assert.match(rank,/option value=\{value\}/);
assert.match(css,/\.pf-rank-mark-selected/);
console.log('PF2e patch 1: 18 skills, saves, Perception, rank progression, JSON v1, old/manual mode.');
