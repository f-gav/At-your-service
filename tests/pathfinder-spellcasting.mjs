import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SPELLCASTING_ABILITIES,SPELL_SLOT_RANKS,selectedSpellcastingAbility,
  isSpellcastingConfigured,isSpellcastingComputedField,spellcastingTotals,
  spellAttackDisplay,calculateSpellcasting,setSpellcastingProficiency,spellSlotCountText,
} from '../src/features/pathfinder/rules-spellcasting.ts';
import {initialSheetValues,persistSheetValues} from '../src/features/pathfinder/sheet-values.ts';

const values={
  level:'20',ability_str:'-1',ability_dex:'2',ability_con:'1',
  ability_int:'8',ability_wis:'4',ability_cha:'5',
  spellcasting_key_ability:'int',spell_attack_rank:'4',spell_dc_rank:'4',
  spell_slots_1:'4',spell_slots_10:'1',
};
assert.equal(SPELLCASTING_ABILITIES.length,6);
assert.equal(SPELL_SLOT_RANKS,10);
assert.equal(selectedSpellcastingAbility(values),'int');
assert.equal(isSpellcastingConfigured(values),true);
assert.equal(isSpellcastingConfigured({...values,spellcasting_key_ability:'unknown'}),false);
assert.equal(isSpellcastingConfigured({...values,spellcasting_key_ability:''}),false);
assert.deepEqual(calculateSpellcasting(values),{
  spell_attack_key:'8',spell_dc_key:'8',
  spell_attack:'+36',spell_dc:'46',
});
assert.deepEqual(calculateSpellcasting({...values,level:'1',spell_attack_rank:'1',spell_dc_rank:'1'}),{
  spell_attack_key:'8',spell_dc_key:'8',
  spell_attack:'+11',spell_dc:'21',
});
assert.equal(calculateSpellcasting({...values,ability_int:'-4',level:'1',spell_attack_rank:'0'}).spell_attack,'-4');
assert.equal(calculateSpellcasting({...values,ability_int:'-4',level:'1',spell_dc_rank:'0'}).spell_dc,'6');
assert.equal(calculateSpellcasting({...values,ability_int:'0',level:'1',spell_attack_rank:'0'}).spell_attack,'+0');
assert.equal(spellAttackDisplay(3),'+3');
assert.equal(spellAttackDisplay(-3),'-3');
assert.equal(spellAttackDisplay(0),'+0');
// No implicit guess of the class's key ability or of missing stats.
assert.deepEqual(calculateSpellcasting({...values,spellcasting_key_ability:''}),{});
assert.deepEqual(calculateSpellcasting({...values,spellcasting_key_ability:'bad'}),{});
assert.deepEqual(calculateSpellcasting({...values,ability_int:''}),{});
assert.deepEqual(calculateSpellcasting({...values,level:''}),{spell_attack_key:'8',spell_dc_key:'8'});
assert.deepEqual(calculateSpellcasting({...values,spell_attack_rank:'',spell_dc_rank:'1'}),{
  spell_attack_key:'8',spell_dc_key:'8',spell_dc:'40'
});
assert.deepEqual(calculateSpellcasting({...values,spell_attack_rank:'3',spell_dc_rank:'4'}),{
  spell_attack_key:'8',spell_dc_key:'8',spell_attack:'+34',spell_dc:'46'
});
assert.equal(isSpellcastingComputedField('spell_dc'),true);
assert.equal(isSpellcastingComputedField('spell_attack_key'),true);
assert.equal(isSpellcastingComputedField('spell_attack_rank'),false);
assert.equal(isSpellcastingComputedField('spell_slots_4'),false);
assert.equal(isSpellcastingComputedField('spell_dc_item'),false);

const changed=setSpellcastingProficiency({...values},2);
assert.equal(changed.spell_attack_rank,'2');
assert.equal(changed.spell_dc_rank,'2');
assert.equal(values.spell_attack_rank,'4','No mutation of old sheet');
assert.equal(setSpellcastingProficiency(values,5),values,'Reject invalid ranks');
for(const [input,expected] of [['',''],['0','0'],['10','10'],['999','999'],['+4',''],['1.5',''],['-1',''],['1000',''],['one','']]){
  assert.equal(spellSlotCountText(input),expected,input);
}

const before={
  pathfinderSheet:{name:'Грацин',schemaVersion:1,...values,old_custom_key:'still-here'},
  notes:'original notes',other:'keep',
};
const loaded=initialSheetValues(before,'Грацин');
const stored=persistSheetValues(before,{...loaded,...calculateSpellcasting(loaded),spell_slots_2:'3'},'Грацин');
const reloaded=initialSheetValues(stored,'Грацин');
assert.equal(reloaded.spell_attack,'+36');
assert.equal(reloaded.spell_dc,'46');
assert.equal(reloaded.spellcasting_key_ability,'int');
assert.equal(reloaded.spell_slots_2,'3');
assert.equal(reloaded.spell_slots_10,'1');
assert.equal(reloaded.old_custom_key,'still-here');
const spellSelections=JSON.stringify([{id:'original-spell',prepared:true},{id:'extra-spell',prepared:false}]);
const withLibrary=initialSheetValues(persistSheetValues(before,{
  ...loaded,pf_spell_display_mode:'library',pf_spell_library_selection:spellSelections,
  pf_spell_available_classes:'["cleric","druid"]',
  pf_spell_available_traditions:'["divine","primal"]',
},'Грацин'),'Грацин');
assert.equal(withLibrary.pf_spell_library_selection,spellSelections,
  'Library spell selections survive a sheet save and reload');
assert.equal(withLibrary.pf_spell_available_classes,'["cleric","druid"]');
assert.equal(withLibrary.pf_spell_available_traditions,'["divine","primal"]');
const textMode=initialSheetValues(persistSheetValues(before,{
  ...withLibrary,pf_spell_display_mode:'text',
},'Грацин'),'Грацин');
assert.equal(textMode.pf_spell_library_selection,spellSelections,
  'Text mode hides library spells without deleting their selections');
assert.equal(textMode.pf_spell_display_mode,'text');

assert.equal(stored.other,'keep');
const oldManual=initialSheetValues({pathfinderSheet:{spell_attack:'+7',spell_dc:'17'}},'Old');
assert.deepEqual(calculateSpellcasting(oldManual),{},'Old manual sheet unaffected until a key ability is selected');

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const dialog=read('../src/features/pathfinder/SpellcastingDialog.tsx');
const css=read('../src/features/pathfinder/SpellcastingDialog.css');
assert.match(sheet,/calculateSpellcasting\(values\)/);
assert.match(sheet,/spellcastingConfigured && isSpellcastingComputedField\(field\.id\)/);
assert.match(sheet,/spellActive&&isSpellcastingComputedField\(key\)/);
assert.match(sheet,/onRankChange=\{changeSpellRank\}/);
assert.match(sheet,/setSpellcastingProficiency\(previous,rank\)/);
assert.match(sheet,/page===4&&<button type="button" className="pf-spell-settings-trigger"/);
assert.match(sheet,/spellSettingsOpen&&<SpellcastingDialog/);
assert.match(sheet,/field\.id==='spell_attack'\|\|field\.id==='spell_dc'/);
assert.match(dialog,/СЛ заклинаний/);
assert.match(dialog,/Бонус атаки/);
assert.match(dialog,/Ключевая характеристика/);
assert.match(dialog,/Умение в заклинаниях/);
assert.match(dialog,/Array\.from\(\{length:SPELL_SLOT_RANKS\}/);
assert.match(dialog,/spellSlotCountText\(event\.target\.value\)/);
assert.match(dialog,/Режим заклинаний/);
assert.match(dialog,/Библиотека/);
assert.match(dialog,/Открыть гримуар/);
assert.match(sheet,/PF_SPELL_SELECTION/);
assert.match(sheet,/spellMode==='library'/);
assert.match(sheet,/spellMode==='text'/);
assert.match(sheet,/grimoireOpen&&<SpellGrimoire/);
assert.match(dialog,/role="dialog" aria-modal="true"/);
assert.match(dialog,/closeCallback\.current\(\)/);
assert.match(css,/\.pf-spell-dialog-backdrop/);
assert.match(css,/@media\(max-width:680px\)/);
console.log('PF2e spellcasting: rank + ability, signed attacks, spell DC, missing data, legacy/manual JSON, 10 slots and in-sheet dialog checked.');
