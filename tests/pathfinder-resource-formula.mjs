import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  evaluateResourceFormula, resourceEffectiveMax, normalizeResource,resourceMarkup,
  resourceFromElement,effectiveResource,chooseResourceCell,RESOURCE_CELL_LIMIT,
} from '../src/features/pathfinder/resource-widget.ts';

const values={level:'5',ability_str:'-1',ability_dex:'+3',ability_con:'2',
  ability_int:'1',ability_wis:'0',ability_cha:'+4'};
assert.deepEqual(evaluateResourceFormula('уровень + харизма + 2',values),{value:11,error:null});
assert.equal(evaluateResourceFormula('(уровень + харизма) * 2',values).value,18);
assert.equal(evaluateResourceFormula('level + cha + 2',values).value,11);
assert.equal(evaluateResourceFormula('2*уровень - (сила+3)',values).value,8);
assert.equal(evaluateResourceFormula('10 / 4',values).value,2,'Fractional maximum rounds down');
assert.equal(evaluateResourceFormula('сила',values).value,0,'Negative result clamps to zero');
assert.equal(evaluateResourceFormula('10000000',values).value,999999);
for(const bad of ['уровень +','другой + 4','уровень**2','foo.bar','alert(1)','Math.random()',
 '1;2','3,5','1/0','(уровень+1','NaN','уровень++']){
 assert.ok(evaluateResourceFormula(bad,values).error,bad);
}
assert.match(evaluateResourceFormula('уровень + харизма',{}).error,/Заполни поле/);
assert.equal(resourceEffectiveMax({max:3,maxFormula:'уровень + харизма + 2'},values).value,11);
assert.equal(resourceEffectiveMax({max:3,maxFormula:''},values).value,3);
assert.equal(normalizeResource({current:7,max:3,maxFormula:'уровень+харизма'}).current,7,
 'Manual fallback max must not erase resource uses for a formula');
assert.equal(effectiveResource({current:11,maxFormula:'уровень+харизма'},values).current,9,
 'Smaller computed max clamps current');
assert.equal(effectiveResource({current:11,maxFormula:'уровень+харизма'},values).max,9);
assert.equal(effectiveResource({current:5,max:3},values).current,3);
let cells={name:'Фокус',current:3,max:5,maxFormula:'',display:'cells',
 recovery:'ten_minutes',notes:'',showNotes:false};
assert.equal(chooseResourceCell(cells,5).current,5);
assert.equal(chooseResourceCell(cells,3).current,2,'Clicking the last filled cell clears it');
assert.equal(chooseResourceCell(cells,2).current,2);
assert.equal(chooseResourceCell(cells,6).current,3,'Can not select a nonexistent cell');
assert.equal(chooseResourceCell(cells,0).current,3);
assert.equal(RESOURCE_CELL_LIMIT,40);
const html=resourceMarkup(cells,values);
assert.equal((html.match(/data-pf-resource-cell="/g)||[]).length,5);
assert.equal((html.match(/aria-pressed="true"/g)||[]).length,3);
assert.match(html,/data-pf-resource-cell="4"/);
assert.match(html,/data-display="cells"/);
assert.match(html,/data-max-formula=""/);
assert.match(html,/aria-label="Ресурс 5 из 5"/);
const dynamic=resourceMarkup({...cells,max:3,maxFormula:'уровень + харизма + 2',current:30},values);
assert.equal((dynamic.match(/data-pf-resource-cell="/g)||[]).length,11);
assert.match(dynamic,/data-current="30"/,'Store original count independently of calculated cap');
assert.match(dynamic,/data-max-formula="уровень \+ харизма \+ 2"/);
assert.match(dynamic,/data-max="3"/,'Keep manual fallback unchanged while formula active');
assert.equal((dynamic.match(/aria-pressed="true"/g)||[]).length,11);
assert.match(resourceMarkup({...cells,max:null,maxFormula:''},values),/Для ячеек нужен максимум/);
assert.doesNotMatch(resourceMarkup({...cells,max:null,maxFormula:''},values),/data-pf-resource-cell=/);
const huge=resourceMarkup({...cells,max:100},values);
assert.doesNotMatch(huge,/data-pf-resource-cell=/);
assert.match(huge,/Больше 40 ячеек/);
const missing=resourceMarkup({...cells,maxFormula:'уровень + харизма'}, {});
assert.match(missing,/Заполни поле «уровень»/,'The widget should explain exactly which stat is missing');
assert.match(missing,/\/ \?/);
assert.doesNotMatch(missing,/data-pf-resource-cell=/);
const escaped=resourceMarkup({...cells,maxFormula:'уровень + харизма'},values);
assert.match(escaped,/data-max-formula="уровень \+ харизма"/);

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const editor=read('../src/features/pathfinder/RichField.tsx');
const dialog=read('../src/features/pathfinder/ResourceDialog.tsx');
const codec=read('../src/features/pathfinder/rich-codec.ts');
const css=read('../src/features/pathfinder/ResourceDialog.css');
const live=read('../src/features/pathfinder/PathfinderSheet.tsx');
const advancing=read('../src/features/pathfinder/DynamicAdvancement.tsx');
assert.match(editor,/resourceContext\?:FormulaContext/);
assert.match(editor,/resourceMarkup\(config,resourceContext\)/);
assert.match(editor,/chooseResourceCell\(effective,index\)/);
assert.match(editor,/handleResourceCell\(widget,Number\(cell\.dataset\.pfResourceCell\)\)/);
assert.match(editor,/resourceEffectiveMax\(stored,resourceContext\)/);
assert.match(editor,/if\(dataChanged\)emit\(\)/);
assert.match(dialog,/option value="cells"/);
assert.match(dialog,/option value="formula"/);
assert.match(dialog,/placeholder="уровень \+ харизма \+ 2"/);
assert.match(dialog,/resourceEffectiveMax\(candidate,resourceContext\)/);
assert.match(dialog,/disabled=\{invalidFormula\|\|missingCellMaximum\}/);
assert.match(codec,/resourceMarkup\(resourceFromElement\(el\)\)/,
 'Formula string survives rich HTML sanitization without becoming a static number');
assert.match(live,/resourceContext=\{values\}/);
assert.match(advancing,/resourceContext=\{values\}/);
assert.match(css,/\.pf-rich-editable \[data-pf-resource-cell\]/);
assert.match(css,/\.pf-resource-dialog \.pf-resource-preview/);
console.log('PF2e resource cells/formulas: arithmetic, real character values, safe parsing, accessibility, caps, old data and persistence.');
