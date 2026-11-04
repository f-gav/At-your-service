import assert from 'node:assert/strict';
import {newDndSheet} from '../src/features/dnd5e/domain/model.ts';
import {validateDndSheet,changeDndLayout} from '../src/features/dnd5e/domain/validation.ts';
import {abilityModifier,proficiencyBonus,skillCheck,savingThrow,initiative,armorClass,effectiveVitals,exhaustionEffects,derivedDndChecks} from '../src/features/dnd5e/domain/rules.ts';
import {applyDndBonuses,d20Formula,mergeAdvantage} from '../src/features/dnd5e/domain/bonuses.ts';
import {packDndSheet,unpackDndSheet,prepareDndDetails,transferDndToAysV2,parseDndAysV2,DND_SAFE_DETAILS_BYTES} from '../src/features/dnd5e/infra/transfer.ts';

const a=newDndSheet('Страж','2014');
assert.equal(a.schemaVersion,1);
assert.equal(a.rulesEdition,'2014');
assert.equal(a.layoutEdition,'2014');
assert.equal(Object.keys(a.abilities).length,6);
assert.equal(abilityModifier(8),-1);
assert.equal(abilityModifier(9),-1);
assert.equal(abilityModifier(20),5);
assert.deepEqual([1,5,9,13,17,20].map(proficiencyBonus),[2,3,4,5,6,6]);
const b=validateDndSheet(a);
b.identity.level=9;
b.abilities.dex.score=16;
b.abilities.wis.score=14;
b.proficiencies.skills.perception='expert';
b.proficiencies.saves.dex='proficient';
assert.equal(skillCheck(b,'perception').value,10);
assert.equal(savingThrow(b,'dex').value,7);
assert.equal(initiative(b).value,3);
assert.equal(armorClass(b),13);
assert.equal(derivedDndChecks(b).skills.perception.value,10);
const converted=changeDndLayout(b,'2024');
assert.equal(converted.layoutEdition,'2024');
assert.equal(converted.rulesEdition,'2014');
assert.equal(skillCheck(converted,'perception').value,10);
assert.deepEqual(changeDndLayout(converted,'2014').abilities,b.abilities);

const trace=applyDndBonuses(10,'ac',[
  {id:'a',source:'spell',target:'ac',op:'add',value:2},
  {id:'b',source:'armor',target:'ac',op:'base',value:13},
  {id:'c',source:'ward',target:'ac',op:'multiply',value:2},
  {id:'d',source:'floor',target:'ac',op:'min',value:28},
  {id:'e',source:'cap',target:'ac',op:'max',value:29},
]);
assert.equal(trace.value,29);
assert.equal(trace.trace.length,5);
assert.equal(applyDndBonuses(4,'skill.stealth',[
  {id:'b',source:'a',target:'skill.stealth',op:'advantage'},
  {id:'c',source:'b',target:'skill.stealth',op:'disadvantage'},
]).advantage,0);
assert.equal(mergeAdvantage(1,-1),0);
assert.equal(d20Formula(5,1),'2d20kh1+5');
assert.equal(d20Formula(-2,-1),'2d20kl1-2');
assert.equal(d20Formula(0),'1d20');
assert.throws(()=>d20Formula(1.5),/модификатор/);

const exhausted=validateDndSheet(b);
exhausted.combat.exhaustion=4;
exhausted.combat.hp.maximumBase=20;
assert.equal(exhaustionEffects(exhausted).abilityDisadvantage,true);
assert.equal(exhaustionEffects(exhausted).saveDisadvantage,true);
assert.equal(effectiveVitals(exhausted).hpMaximum,10);
assert.equal(effectiveVitals(exhausted).walkSpeed,15);
assert.equal(savingThrow(exhausted,'dex').advantage,-1);
assert.equal(skillCheck(exhausted,'perception').advantage,-1);
const newer=validateDndSheet({...exhausted,rulesEdition:'2024'});
assert.equal(exhaustionEffects(newer).d20Penalty,-8);
assert.equal(effectiveVitals(newer).hpMaximum,20);
assert.equal(effectiveVitals(newer).walkSpeed,10);
assert.equal(savingThrow(newer,'dex').value,-1);
assert.equal(skillCheck(newer,'perception').value,2);
assert.equal(skillCheck(newer,'perception').advantage,0);
newer.combat.exhaustion=6;
assert.equal(effectiveVitals(newer).dead,true);

const preserved=prepareDndDetails({notes:'Скрытая история',futureKey:{marker:42}},newer);
assert.equal(preserved.notes,'Скрытая история');
assert.deepEqual(preserved.futureKey,{marker:42});
assert.equal(preserved.dnd5eSheet.rulesEdition,'2024');
const packed=transferDndToAysV2('Страж',preserved);
assert.ok(!('dnd5eSheet' in packed.details));
assert.equal(packed.sheet.combat.exhaustion,6);
const envelope={system:'DnD',format:'at-your-service-character',version:2,character:{name:'Страж',...packed}};
const roundtrip=parseDndAysV2(JSON.parse(JSON.stringify(envelope)));
assert.deepEqual(roundtrip.details,preserved);
assert.equal(unpackDndSheet(packDndSheet(newer)).layoutEdition,'2014');
assert.throws(()=>parseDndAysV2({...envelope,version:3}),/версия/);
assert.throws(()=>validateDndSheet({...newer,rulesEdition:'2030'}),/редакция/);
assert.throws(()=>validateDndSheet({...newer,abilities:{...newer.abilities,str:{score:99}}}),/характеристики/);
assert.throws(()=>validateDndSheet({...newer,bonuses:[{id:'same'},{id:'same'}]}),/повторный/);
const huge=validateDndSheet(newDndSheet('Огромный'));
huge.content.blocks.story='Г'.repeat(14000);
huge.content.blocks.appendix='Г'.repeat(12000);
assert.throws(()=>prepareDndDetails({},huge),/предел/);
assert.ok(DND_SAFE_DETAILS_BYTES<65536);
console.log('PASS: D&D 2014/2024 mechanics, independent layouts, bonus precedence, JSON round-trip, byte budget');
