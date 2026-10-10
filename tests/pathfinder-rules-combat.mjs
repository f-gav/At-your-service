import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateCombat, isCombatComputedField, weaponResult, applyShieldBlock,
  shieldIsBroken, shieldBrokenThreshold } from '../src/features/pathfinder/rules-combat.ts';
import { persistSheetValues,initialSheetValues } from '../src/features/pathfinder/sheet-values.ts';

const baseline = {
  name:'Эллара', level:'1',ability_str:'2',ability_dex:'4',ability_con:'1',
  armor_rank_0:'1',armor_rank_1:'1',armor_rank_2:'1',
  weapon_rank_1:'1', weapon_rank_2:'2',
  hp_current:'11',hp_temp:'3',
};
assert.deepEqual(calculateCombat(baseline),{},'No formula must run until independently enabled');
const armor={...baseline,combat_armor_enabled:'true',combat_armor_category:'1',
  combat_armor_dex_cap:'2',combat_armor_item_bonus:'2',combat_armor_other_ac:'1'};
assert.equal(calculateCombat(armor).armor_class,'18'); // 10+2 Dex+3 trained+2 item+1 other
assert.equal(calculateCombat(armor).armor_dex,'+2');
assert.equal(calculateCombat(armor).armor_prof,'+3');
assert.equal(calculateCombat(armor).armor_item,'+2');
assert.equal(calculateCombat({...armor,level:'5'}).armor_class,'22');
assert.equal(calculateCombat({...armor,combat_armor_category:''}).armor_class,undefined);
assert.equal(calculateCombat({...armor,combat_armor_dex_cap:''}).armor_class,undefined);
const shield={...armor,combat_shield_enabled:'true',combat_shield_raised:'true',
  combat_shield_ac_bonus:'2',shield_max_hp:'20',shield_hp:'18',shield_hardness:'5',
  combat_can_shield_block:'true'};
assert.equal(calculateCombat(shield).armor_class,'20');
assert.equal(calculateCombat(shield).shield_broken,'10');
assert.equal(shieldBrokenThreshold(23),11);
assert.equal(shieldIsBroken({...shield,shield_hp:'10'}),true);
assert.equal(shieldIsBroken({...shield,shield_max_hp:'',shield_hp:'0'}),true);
assert.equal(calculateCombat({...shield,shield_hp:'10'}).armor_class,'18');
assert.equal(calculateCombat({...shield,combat_shield_raised:'false'}).armor_class,'18');
assert.equal(calculateCombat({...shield,combat_shield_ac_bonus:''}).armor_class,'18');
const armorSkills={...armor,combat_armor_skill_penalty_enabled:'true',
  combat_armor_check_penalty:'2',combat_armor_strength_requirement:'3',ability_str:'2'};
const negativeSkills=calculateCombat(armorSkills);
assert.equal(negativeSkills.skill_acrobatics_armor,'-2');
assert.equal(negativeSkills.skill_athletics_armor,'-2');
assert.equal(calculateCombat({...armorSkills,ability_str:'4'}).skill_stealth_armor,'0');
assert.equal(isCombatComputedField(armorSkills,'skill_thievery_armor'),true);
assert.equal(calculateCombat({...armorSkills,combat_armor_skill_penalty_enabled:'false'}).skill_thievery_armor,undefined);
assert.equal(isCombatComputedField(shield,'armor_class'),true);
assert.equal(isCombatComputedField(shield,'shield_broken'),true);
assert.equal(isCombatComputedField(shield,'hp_current'),false);
const afterBlock=applyShieldBlock(shield,12);
assert.equal(afterBlock.shield_hp,'11'); // 12-5 hardness = 7 to shield
assert.equal(afterBlock.hp_temp,'0'); // 3 temporary absorbs before character HP
assert.equal(afterBlock.hp_current,'7'); // 11-4
assert.throws(()=>applyShieldBlock({...shield,shield_hp:'10'},5),/Нельзя блокировать/);
assert.throws(()=>applyShieldBlock({...shield,combat_can_shield_block:'false'},5),/Нельзя блокировать/);
assert.throws(()=>applyShieldBlock(shield,-1),/Введите/);
const hp={...baseline,combat_hp_enabled:'true',combat_hp_ancestry:'8',
  combat_hp_class:'8',combat_hp_extra_per_level:'1',combat_hp_extra_flat:'2'};
assert.equal(calculateCombat(hp).hp_max,'20');
assert.equal(calculateCombat({...hp,level:'3'}).hp_max,'40');
assert.equal(calculateCombat({...hp,combat_hp_ancestry:''}).hp_max,undefined);
assert.equal(isCombatComputedField(hp,'hp_max'),true);
assert.equal(isCombatComputedField(hp,'hp_current'),false);
assert.equal(isCombatComputedField(hp,'hp_temp'),false);
// weapon 1: melee finesse, agile, rank simple trained, striking 2d6; Dex +4 beats Str +2.
const weapon={...baseline,combat_weapon_1_enabled:'true',
  combat_weapon_1_category:'1',combat_weapon_1_kind:'melee',
  combat_weapon_1_finesse:'true',combat_weapon_1_agile:'true',
  combat_weapon_1_dice:'2d6',combat_weapon_1_item_attack:'1',combat_weapon_1_other_damage:'2'};
assert.deepEqual(weaponResult(weapon,1),{attack:8,second:4,third:0,damage:'2d6+4',agile:true});
assert.equal(calculateCombat(weapon).weapon_1_attack,'+8');
assert.equal(calculateCombat(weapon).weapon_1_damage,'2d6+4');
assert.equal(weaponResult({...weapon,combat_weapon_1_kind:'ranged'},1)?.damage,'2d6+2');
assert.equal(weaponResult({...weapon,combat_weapon_1_kind:'thrown'},1)?.damage,'2d6+4');
assert.equal(weaponResult({...weapon,combat_weapon_1_kind:'ranged',combat_weapon_1_propulsive:'true'},1)?.damage,'2d6+3');
assert.equal(weaponResult({...weapon,ability_str:'-3',combat_weapon_1_kind:'ranged',combat_weapon_1_propulsive:'true'},1)?.damage,'2d6-1');
assert.equal(weaponResult({...weapon,combat_weapon_1_dice:'invalid'},1)?.damage,'');
assert.equal(calculateCombat({...weapon,combat_weapon_1_enabled:'false'}).weapon_1_attack,undefined);
assert.equal(isCombatComputedField(weapon,'weapon_1_attack'),true);
assert.equal(isCombatComputedField(weapon,'weapon_2_attack'),false);
// JSON v1 retains all configuration without changing native character keys.
const details={pathfinderSheet:{...armor,...hp,...weapon,combat_shield_enabled:'true'},notes:'Keep'};
const stored=persistSheetValues(details,{...details.pathfinderSheet,...calculateCombat(details.pathfinderSheet)},'Эллара');
const data=JSON.parse(JSON.stringify({version:1,system:'Pathfinder',character:{details:stored,name:'Эллара'}}));
const restored=initialSheetValues(data.character.details,'Эллара');
assert.equal(restored.combat_hp_class,'8');
assert.equal(restored.combat_weapon_1_dice,'2d6');
assert.equal(restored.combat_armor_category,'1');
assert.equal(restored.hp_current,'11');

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const ui=read('../src/features/pathfinder/PathfinderSheet.tsx');
const panel=read('../src/features/pathfinder/CombatPanel.tsx');
assert.match(ui,/calculateCombat\(values\)/);
assert.match(ui,/isCombatComputedField\(values,key\)/);
assert.match(ui,/onMultiple=\{replaceCombatValues\}/);
assert.match(panel,/applyShieldBlock\(v,d\)/);
assert.match(panel,/combat_weapon_/);
console.log('PF2e combat patch: AC/dex cap/armor ranks/shield, HP and 5 weapons, block reaction, JSON v1.');
