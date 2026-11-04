import assert from 'node:assert/strict';
import {newDndSheet} from '../src/features/dnd5e/domain/model.ts';
import {validateDndSheet,changeDndLayout} from '../src/features/dnd5e/domain/validation.ts';
import {attackCheck,skillCheck,armorClass,effectiveVitals} from '../src/features/dnd5e/domain/rules.ts';
import {
  evaluateDndExpression,rollDndFormula,selectSpells,changeSpellFlag,castSpell,
  effectiveCasterLevel,multiclassSlots,spendResource,resetResources,tickDndEffects,
  resourceMaximum,conditionsFor,effectiveBonuses,classLevelTotal
} from '../src/features/dnd5e/domain/advanced.ts';
import {applyDndBonuses} from '../src/features/dnd5e/domain/bonuses.ts';
import {prepareDndDetails} from '../src/features/dnd5e/infra/transfer.ts';
const old=newDndSheet('Странник','2014');
const next=newDndSheet('Звездочёт','2024');
next.abilities.str.score=18;next.abilities.dex.score=14;next.identity.level=5;
assert.equal(evaluateDndExpression('[STR]+[PROF]',next),7);
assert.equal(evaluateDndExpression('floor([LVL]/2)',next),2);
assert.equal(evaluateDndExpression('2^[PROF]',next),8);
assert.equal(evaluateDndExpression('if([STR]>=3,6,2)',next),6);
assert.equal(evaluateDndExpression('if([STR]<3,6,2)',next),2);
assert.throws(()=>evaluateDndExpression('if([BOGUS]>=3,6,2)',next),/переменная/);
assert.throws(()=>evaluateDndExpression('2d6+[STR]',next),/источника/);
assert.throws(()=>evaluateDndExpression('a'.repeat(350),next),/длинная/);
assert.equal(rollDndFormula('2d6+[STR]',next,()=>.5).total,12);
assert.equal(rollDndFormula('2d20kh1+[PROF]',next,()=>.5).total,14);
assert.equal(rollDndFormula('3к6dl1',next,()=>.5).total,8);
assert.equal(rollDndFormula('1d6ro=1',next,(()=>{const r=[0,.5];return()=>r.shift()??.5;})()).total,4);
assert.deepEqual(rollDndFormula('1d6!',next,(()=>{const r=[.999,.5];return()=>r.shift()??.5;})()),{total:10,faces:[6,4]});
assert.equal(rollDndFormula('if([STR]>=3,2d6,1d6)',next,()=>.5).total,8);
assert.throws(()=>rollDndFormula('1d6!',next,()=>.999),/взрывов/);
assert.throws(()=>rollDndFormula('1d6ro=1',next,()=>1),/небезопасный/);
assert.throws(()=>rollDndFormula('1d6ro=7',next,()=>.5),/нотация/);
next.bonuses.push({id:'ac1',source:'Кольцо',target:'ac',op:'add',value:1});
next.effects.push({id:'fx1',name:'Благословение',active:true,rounds:3,
  bonuses:[{id:'ac2',source:'эффект',target:'ac',op:'add',value:2}]});
assert.equal(armorClass(next),15);
assert.equal(effectiveBonuses(next).length,2);
assert.equal(applyDndBonuses(12,'ac',effectiveBonuses(next)).value,15);
next.effects[0].active=false;
assert.equal(armorClass(next),13);
next.effects[0].active=true;
next.effects.push({id:'fx2',name:'Захват',active:true,rounds:1,condition:'grappled'});
assert.equal(effectiveVitals(next).walkSpeed,0);
assert.ok(conditionsFor(next).includes('grappled'));
assert.equal(attackCheck(next,'str',true).advantage,-1);
const tick=tickDndEffects(next);
assert.equal(tick.effects[1].active,false);
assert.equal(tick.effects[1].rounds,0);
assert.equal(tick.effects[0].rounds,2);
next.resources.push({id:'rage',name:'Ярость',current:2,maximum:3,reset:'long',formula:'[PROF]'});
assert.equal(resourceMaximum(next.resources[0],next),3);
assert.equal(spendResource(next,'rage').resources[0].current,1);
assert.throws(()=>spendResource(next,'rage',3),/недостаточно/);
next.resources.push({id:'ki',name:'Ки',current:0,maximum:4,reset:'short'});
next.spellcasting.slots.normal['1']={maximum:4,used:2};
next.spellcasting.slots.pact['2']={maximum:2,used:1};
const short=resetResources(next,'short');
assert.equal(short.resources.find(r=>r.id==='ki').current,4);
assert.equal(short.resources.find(r=>r.id==='rage').current,2);
assert.equal(short.spellcasting.slots.pact['2'].used,0);
assert.equal(short.spellcasting.slots.normal['1'].used,2);
const long=resetResources(next,'long');
assert.equal(long.resources.find(r=>r.id==='rage').current,3);
assert.equal(long.spellcasting.slots.normal['1'].used,0);
next.spellcasting.spells.push({id:'spell-1',name:'Свет',level:1,source:'homebrew',known:true,inBook:true,prepared:false});
assert.equal(selectSpells(next,'known').length,1);
assert.equal(selectSpells(next,'book').length,1);
assert.equal(selectSpells(next,'prepared').length,0);
assert.throws(()=>castSpell(next,'spell-1','normal',1),/подготовлено/);
const prepared=changeSpellFlag(next,'spell-1','prepared',true);
assert.equal(selectSpells(prepared,'prepared').length,1);
const cast=castSpell(prepared,'spell-1','normal',1);
assert.equal(cast.spellcasting.slots.normal['1'].used,3);
assert.equal(prepared.spellcasting.slots.normal['1'].used,2);
assert.equal(castSpell(prepared,'spell-1','pact',2).spellcasting.slots.pact['2'].used,2);
assert.throws(()=>castSpell(cast,'spell-1','pact',2),/закончились/);
assert.throws(()=>castSpell(prepared,'spell-1','normal',0),/неподходящий/);
assert.equal(effectiveCasterLevel([
  {id:'a',name:'Wizard',level:5,spellcasting:'full'},
  {id:'b',name:'Paladin',level:3,spellcasting:'half'},
], '2014'),6);
assert.equal(effectiveCasterLevel([
  {id:'a',name:'Wizard',level:5,spellcasting:'full'},
  {id:'b',name:'Paladin',level:3,spellcasting:'half'},
], '2024'),7);
assert.equal(multiclassSlots([{id:'a',name:'Wizard',level:5,spellcasting:'full'},
  {id:'b',name:'Warlock',level:3,spellcasting:'pact'}],'2024').slots['3'],2);
assert.equal(classLevelTotal([{id:'a',name:'Wizard',level:5},{id:'b',name:'Warlock',level:3}]),8);
const validated=validateDndSheet(prepared);
assert.deepEqual(validated.spellcasting.spells,prepared.spellcasting.spells);
assert.deepEqual(changeDndLayout(changeDndLayout(validated,'2014'),'2024').resources,validated.resources);
assert.deepEqual(prepareDndDetails({},validated).dnd5eSheet,validated);
assert.throws(()=>validateDndSheet({...old,resources:[{id:'i',name:'bad',current:6,maximum:1,reset:'long'}]}),/ресурс/);
assert.throws(()=>validateDndSheet({...old,classes:[{id:'a',name:'A',level:20},{id:'b',name:'B',level:1}]}),/20/);
assert.throws(()=>validateDndSheet({...old,effects:[{id:'a',name:'bad',active:true,rounds:-1}]}),/эффект/);
console.log('PASS: D&D advanced formulas, dice, effects, resources, spells, slots, multiclass, JSON and layout invariants');