import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withWeaponSheetFields, WEAPON_SHEET_FIELDS } from '../src/features/pathfinder/weapon-fields.ts';
import { calculateNativeCombat, isNativeWeaponAttackField } from '../src/features/pathfinder/rules-combat.ts';
import { formulaDisplayValue } from '../src/features/pathfinder/formula-display.ts';
import { buildBardDemo } from '../src/features/pathfinder/bard-demo.ts';

const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const original=JSON.parse(read('../src/features/pathfinder/fields.json'));
const migrated=withWeaponSheetFields(original);

assert.equal(WEAPON_SHEET_FIELDS.length,30);
assert.equal(migrated.length,original.length+30);
assert.equal(withWeaponSheetFields(migrated).length,migrated.length,'Idempotent migration');
for (let i=1;i<=5;i++){
  const old=original.find(f=>f.id==='weapon_'+i+'_attack');
  const attack=migrated.find(f=>f.id==='weapon_'+i+'_attack');
  assert.ok(old.x>425,'Legacy attack incorrectly lives over STR operand');
  assert.ok(attack.x<422,'Calculated attack must live inside axe/arrow artwork');
  assert.ok(attack.fontSize>=12);
  assert.equal(migrated.filter(f=>f.id==='weapon_'+i+'_attack').length,1);
  for(const part of ['ability','prof','item']){
    const f=migrated.find(f=>f.id==='weapon_'+i+'_'+part);
    assert.equal(f.kind,'number');
    assert.ok(f.x>=426&&f.x<483);
    assert.equal(formulaDisplayValue(f.id,'-2'),'2');
    assert.equal(formulaDisplayValue(f.id,'-2',true),'-2');
  }
  const dmgY=migrated.filter(f=>f.id.startsWith('weapon_'+i+'_damage_'));
  assert.deepEqual(dmgY.map(f=>f.id.split('_').pop()),['bludgeoning','piercing','slashing']);
  assert.ok(dmgY.every(f=>f.kind==='toggle'&&f.toggleShape==='circle'));
  assert.ok(dmgY.every(f=>f.x>=560&&f.x<580));
}
const moved=[{...original.find(f=>f.id==='weapon_1_attack'),x:398,y:394.2,w:25}];
assert.equal(withWeaponSheetFields(moved)[0].x,398,'Do not move admin-customized attack');
const b=buildBardDemo(migrated);
for(let i=1;i<=5;i++){
  const prefix='weapon_'+i+'_';
  assert.equal(
    Number(b[prefix+'attack']),
    Number(b[prefix+'ability'])+Number(b[prefix+'prof'])+Number(b[prefix+'item']),
    'Bard test value should match attack strip');
  assert.equal(
    ['bludgeoning','piercing','slashing'].filter(t=>b[prefix+'damage_'+t]==='true').length,1,
    'Bard preview selects a single physical damage type');
}
assert.equal(calculateNativeCombat({weapon_1_ability:'+4',weapon_1_prof:'3',weapon_1_item:'+1'}).weapon_1_attack,'+8');
assert.equal(calculateNativeCombat({weapon_2_ability:'-1',weapon_2_prof:'0',weapon_2_item:'0'}).weapon_2_attack,'-1');
assert.equal(calculateNativeCombat({weapon_3_ability:'',weapon_3_prof:'3',weapon_3_item:''}).weapon_3_attack,'+3');
assert.equal(calculateNativeCombat({weapon_4_ability:'3',weapon_4_prof:'bad',weapon_4_item:'0'}).weapon_4_attack,undefined);
assert.equal(calculateNativeCombat({weapon_5_attack:'+9'}).weapon_5_attack,undefined,
  'Legacy manually saved attack remains available until operands are configured');
assert.ok(isNativeWeaponAttackField('weapon_5_attack'));
assert.ok(!isNativeWeaponAttackField('weapon_5_item'));
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const schema=read('../src/features/pathfinder/editor-schema.ts');
const admin=read('../src/features/pathfinder/TemplateAdmin.tsx');
assert.match(sheet,/setTemplateFields\(withClassDcNumericBonus\(withWeaponSheetFields\(withEquipmentNumberFields/);
assert.match(admin,/withWeaponSheetFields\(withEquipmentNumberFields/);
assert.match(schema,/withWeaponSheetFields\(withEquipmentNumberFields/);
assert.match(sheet,/id === 'armor_class' \|\| isNativeWeaponAttackField\(field.id\)/);
assert.match(sheet,/weapon_'\+mark\[1\]\+'_damage_'\+type/);
assert.match(sheet,/type===mark\[2\]/);
console.log('PF2e native weapons: 5 totals in icons, 15 editable operands, 15 exclusive D/K/R circles.');
