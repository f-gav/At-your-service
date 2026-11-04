import assert from 'node:assert/strict';
import {newDndSheet} from '../src/features/dnd5e/domain/model.ts';
import {changeDndLayout,validateDndSheet} from '../src/features/dnd5e/domain/validation.ts';
import {dndFormulaVariables,rollDndLssFormula,evaluateDndNumericFormula} from '../src/features/dnd5e/domain/lss-formulas.ts';
import {activeDndBonuses,applyDndBonuses} from '../src/features/dnd5e/domain/bonuses.ts';
import {abilityModifier,effectiveVitals,initiative,skillCheck,attackCheck} from '../src/features/dnd5e/domain/rules.ts';
import {assignDndClasses,suggestDndSpellSlots,applySuggestedSlots,castDndSpell,
  restoreDndRest,updateDndResource,advanceDndEffect,dndConditionModifiers} from '../src/features/dnd5e/domain/advanced.ts';
import {prepareDndDetails,parseDndAysV2,transferDndToAysV2} from '../src/features/dnd5e/infra/transfer.ts';

const fixed=(...seq)=>{let i=0;return()=>seq[i++]??0;};
const base=newDndSheet('Бореал','2024');
base.identity.level=5;
base.abilities.str.score=16;
base.abilities.wis.score=14;
const vars=dndFormulaVariables(base);
assert.equal(vars.STR,3);assert.equal(vars.WIS,2);assert.equal(vars.PROF,3);
assert.equal(vars.HALF_PROF,1);assert.equal(vars.LVL,5);
assert.equal(abilityModifier(16),3);
assert.equal(evaluateDndNumericFormula('floor([LVL]/2)+[PROF]',vars),5);
assert.equal(evaluateDndNumericFormula('if([LVL]>=5,2^3,1)',vars),8);
assert.equal(evaluateDndNumericFormula('if([LVL]<3,2,7)',vars),7);
assert.equal(evaluateDndNumericFormula('max(2,[WIS]) * 2',vars),4);
assert.equal(evaluateDndNumericFormula('10%3',vars),1);
assert.throws(()=>evaluateDndNumericFormula('2d6',vars),/запрещены/);
assert.throws(()=>evaluateDndNumericFormula('process.exit()',vars),/D&D/);
assert.throws(()=>evaluateDndNumericFormula('1/0',vars),/деление на ноль/);
assert.equal(rollDndLssFormula('4d6dl1',{},fixed(0,.25,.5,.99)).total,12);
assert.equal(rollDndLssFormula('2d20kh1',{},fixed(0,.99)).total,20);
assert.equal(rollDndLssFormula('1d20ro=1',{},fixed(0,.5)).total,11);
assert.equal(rollDndLssFormula('1d10!',{},fixed(.99,0)).total,11);
assert.equal(rollDndLssFormula('1d6min2',{},fixed(0)).total,2);
assert.equal(rollDndLssFormula('d%',{},fixed(0)).total,1);
assert.equal(rollDndLssFormula('dF',{},fixed(0)).total,-1);
assert.equal(rollDndLssFormula('2d6+3',{},fixed(0,0)).total,5);
assert.equal(rollDndLssFormula('3к8+[STR]',vars,fixed(0,0,0)).total,6);
assert.equal(rollDndLssFormula('(ceil([LVL]/2))d6',vars,fixed(0,0,0)).total,3);
assert.equal(rollDndLssFormula('[[STR]+1]d6',vars,fixed(0,0,0,0)).total,4);
assert.equal(rollDndLssFormula('if([LVL]>=5,2d6,1d6)',vars,fixed(0,0)).total,2);
assert.equal(rollDndLssFormula('10d10>=8',{},fixed(...Array(10).fill(.99))).total,10);
assert.throws(()=>rollDndLssFormula('1001d6',{},fixed(0)),/слишком много костей|1000/);
assert.throws(()=>rollDndLssFormula('1d6!',{},fixed(.99)),/100/);
assert.throws(()=>rollDndLssFormula('1d20+[FAKE]',vars,fixed(0)),/неизвестная переменная/);
assert.throws(()=>rollDndLssFormula('1d0',{},fixed(0)),/граней/);
assert.throws(()=>rollDndLssFormula('1d6 + 1d6'.repeat(200),{},fixed(0)),/1000/);
assert.equal(rollDndLssFormula('1d20 # Проверка ловкости',{},fixed(0)).label,'Проверка ловкости');

base.effects=[
  {id:'poison',name:'Отравление',active:false,condition:'poisoned',remainingRounds:2},
  {id:'grapple',name:'Захват',active:false,condition:'grappled',remainingRounds:3},
];
base.bonuses=[
  {id:'base',source:'Доспех',target:'ac',op:'base',value:14,active:true},
  {id:'effect',source:'Сила эффекта',target:'ac',op:'add',formula:'floor([LVL]/2)',effectId:'poison'},
  {id:'final',source:'Кольцо',target:'ac',op:'override',value:19,active:false},
];
assert.equal(activeDndBonuses(base).length,2);
assert.equal(applyDndBonuses(10,'ac',activeDndBonuses(base),vars).value,14);
base.effects[0].active=true;
assert.equal(activeDndBonuses(base).length,3);
assert.equal(applyDndBonuses(10,'ac',activeDndBonuses(base),vars).value,16);
base.bonuses[2].active=true;
assert.equal(applyDndBonuses(10,'ac',activeDndBonuses(base),vars).value,19);
assert.equal(initiative(base).advantage,-1);
assert.equal(skillCheck(base,'athletics').advantage,-1);
assert.equal(attackCheck(base,'str',true).advantage,-1);
base.effects[1].active=true;
assert.equal(dndConditionModifiers(base).immobile,true);
assert.equal(effectiveVitals(base).walkSpeed,0);
base.effects[1].active=false;
base.effects[0].active=false;
assert.equal(effectiveVitals(base).walkSpeed,30);
const afterTick=advanceDndEffect({...base,effects:[{...base.effects[1],active:true,remainingRounds:1}]},'grapple');
assert.equal(afterTick.effects[0].active,false);
assert.equal(afterTick.effects[0].remainingRounds,0);
assert.throws(()=>advanceDndEffect(base,'missing'),/не найден/);

const classes=[
  {id:'ranger',name:'Следопыт',level:3,caster:'half'},
  {id:'wizard',name:'Волшебник',level:3,caster:'full'},
  {id:'warlock',name:'Колдун',level:3,caster:'pact'},
];
const advanced=assignDndClasses(base,classes);
assert.equal(advanced.identity.level,9);
assert.equal(suggestDndSpellSlots(classes,'2014').casterLevel,4);
assert.equal(suggestDndSpellSlots(classes,'2024').casterLevel,5);
assert.deepEqual(Object.values(suggestDndSpellSlots(classes,'2024').normal).map(v=>v.maximum),[4,3,2]);
assert.deepEqual(suggestDndSpellSlots(classes,'2024').pact['2'],{maximum:2,used:0});
const proposed=applySuggestedSlots(advanced);
assert.equal(proposed.spellcasting.slots.normal['1'].maximum,4);
assert.equal(proposed.spellcasting.slots.normal['3'].maximum,2);
assert.equal(proposed.spellcasting.slots.pact['2'].maximum,2);
const activeSpell={id:'magic',name:'Волшебная стрела',level:1,source:'homebrew',
  known:true,prepared:true,inBook:true,description:'ays:rich:v1:<b>Описание</b>'};
const saved=validateDndSheet({...proposed,spellcasting:{
  ...proposed.spellcasting,spells:[activeSpell,
    {id:'scroll',name:'Книга',level:2,source:'homebrew',inBook:true},
    {id:'slotless',name:'Тайная тайна',level:1,source:'homebrew',granted:true,slotless:true}],
}});
const used=castDndSpell(saved,'magic','pact',2);
assert.equal(used.spellcasting.slots.pact['2'].used,1);
assert.equal(used.spellcasting.slots.normal['1'].used,0);
assert.equal(castDndSpell(used,'magic','normal',1).spellcasting.slots.normal['1'].used,1);
assert.throws(()=>castDndSpell(used,'scroll','normal',2),/не подготовлено/);
assert.throws(()=>castDndSpell(used,'slotless','normal',1),/без ячеек/);
assert.throws(()=>castDndSpell(used,'magic','pact',1),/нет свободных|неверный круг/);
const withResources=validateDndSheet({...used,resources:[
 {id:'rage',name:'Ярость',current:0,maximum:3,restoreOn:'long'},
 {id:'ki',name:'Очки ци',current:0,maximum:4,restoreOn:'short'},
 {id:'manual',name:'Особый',current:0,maximum:1,restoreOn:'manual'},
]});
assert.equal(updateDndResource(withResources,'rage',1).resources[0].current,1);
assert.equal(restoreDndRest(withResources,'short').resources[0].current,0);
assert.equal(restoreDndRest(withResources,'short').resources[1].current,4);
assert.equal(restoreDndRest(withResources,'long').resources[0].current,3);
assert.equal(restoreDndRest(withResources,'long').resources[2].current,0);
assert.equal(restoreDndRest(withResources,'short').spellcasting.slots.pact['2'].used,0);
assert.throws(()=>validateDndSheet({...used,resources:[{id:'bad',name:'Неправильный',current:5,maximum:1,restoreOn:'short'}]}),/ресурс/);
assert.throws(()=>validateDndSheet({...used,progression:{classes:[{id:'x',name:'X',level:21,caster:'full'}],slotMode:'manual'}}),/уровни/);

const mixed=changeDndLayout(withResources,'2014');
const restored=changeDndLayout(mixed,'2024');
assert.equal(restored.rulesEdition,'2024');
assert.deepEqual(restored.resources,withResources.resources);
assert.deepEqual(restored.spellcasting.spells,saved.spellcasting.spells);
assert.deepEqual(restored.progression,withResources.progression);
const prepared=prepareDndDetails({notes:'Оставить',custom:{flag:true}},restored);
const exported=transferDndToAysV2(restored.identity.name,prepared);
const imported=parseDndAysV2({format:'at-your-service-character',version:2,system:'DnD',
  character:{name:restored.identity.name,details:exported.details,sheet:exported.sheet}});
assert.deepEqual(imported.details,prepared);
assert.deepEqual(imported.details.dnd5eSheet.bonuses,base.bonuses);
console.log('PASS D&D advanced: LSS-style dice, safe numeric formulas, effects, bonuses, multiclass, Pact Magic, spells, rests, AYS v2 JSON');
