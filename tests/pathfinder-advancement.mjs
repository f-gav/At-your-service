import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advancementLevelCount, addAdvancementLevel, removeAdvancementLevel,
  isAdvancementField, ancestryHint, classHint, ADVANCEMENT_COUNT_KEY,
  MAX_ADVANCEMENT_LEVEL
} from '../src/features/pathfinder/advancement-model.ts';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const original=JSON.parse(read('../src/features/pathfinder/fields.json'));
const first=['ancestry_features','ancestry_feat_1','background_skill_feat','class_features_1'];
assert.ok(first.every(id=>isAdvancementField(id)));
assert.equal(original.filter(f=>isAdvancementField(f.id)).length,42);
assert.equal(isAdvancementField('inventory_held'),false);
assert.equal(advancementLevelCount({}),1,'first level always exists');
assert.equal(advancementLevelCount({feat_level_7:'Старинная черта'}),7,'old characters never lose later level content');
assert.equal(advancementLevelCount({[ADVANCEMENT_COUNT_KEY]:'2',class_level_5:'Муза'}),5,'saved count cannot hide legacy content');
assert.equal(advancementLevelCount({[ADVANCEMENT_COUNT_KEY]:'99'}),1,'corrupted counts are ignored');
assert.equal(MAX_ADVANCEMENT_LEVEL,20);
let v={ancestry_features:'Дар',ancestry_feat_1:'Человек',background_skill_feat:'Артист',class_features_1:'Барды'};
assert.equal(advancementLevelCount(v),1);
v=addAdvancementLevel(v);
assert.equal(advancementLevelCount(v),2);
assert.equal(v[ADVANCEMENT_COUNT_KEY],'2');
v={...v,feat_level_2:'Слух',class_level_2:'Муза'};
v=addAdvancementLevel(v);
v={...v,feat_level_3:'Мастерство',class_level_3:'Песнь'};
v=addAdvancementLevel(v);
v={...v,feat_level_4:'Высота',class_level_4:'Магия'};
assert.equal(advancementLevelCount(v),4);
let removed=removeAdvancementLevel(v,2);
assert.equal(removed[ADVANCEMENT_COUNT_KEY],'3');
assert.equal(removed.feat_level_2,'Мастерство');
assert.equal(removed.class_level_2,'Песнь');
assert.equal(removed.feat_level_3,'Высота');
assert.equal(removed.class_level_3,'Магия');
assert.equal(removed.feat_level_4,'');
assert.equal(removed.class_level_4,'');
assert.equal(removed.ancestry_features,'Дар');
assert.deepEqual(removeAdvancementLevel(v,1),v,'first level cannot be removed');
assert.deepEqual(removeAdvancementLevel(v,42),v,'out of range removal cannot modify data');
const maximum={...v,[ADVANCEMENT_COUNT_KEY]:'20'};
assert.deepEqual(addAdvancementLevel(maximum),maximum,'levels stop at 20');
assert.equal(ancestryHint(5),'Черта народа · Повышения');
assert.equal(ancestryHint(2),'Черта навыка');
assert.equal(classHint(3),'Классовая особенность');

const component=read('../src/features/pathfinder/DynamicAdvancement.tsx');
const css=read('../src/features/pathfinder/DynamicAdvancement.css');
const sheet=read('../src/features/pathfinder/PathfinderSheet.tsx');
const admin=read('../src/features/pathfinder/TemplateAdmin.tsx');
assert.match(component,/className="pf-advancement-input"/);
assert.match(component,/placeholder=\{hint\}/,'labels must be placeholders, not PDF ink');
assert.match(component,/target\.scrollHeight/,'textarea must grow to fit content');
assert.match(component,/level=\{1\} canRemove=\{false\}/,'first level has no delete control');
assert.match(component,/aria-label=\{'Удалить уровень '\+level\}/);
assert.match(component,/aria-label="Добавить уровень"/);
assert.match(css,/overflow:hidden/);
assert.match(css,/field-sizing:content/);
assert.match(css,/pf-advancement-star:hover \.pf-advancement-level-remove/);
assert.match(css,/\.pf-sheet-page\.pf-sheet-page-advancement/);
assert.match(sheet,/page!==2 \|\| !isAdvancementField\(field\.id\)/,
 'old twenty levels must not show under dynamically rendered ones');
assert.doesNotMatch(sheet,/window\.confirm\('Вы точно хотите удалить уровень\?'\)/,
  'Browser-native confirm must not be used for level deletion');
assert.doesNotMatch(admin,/confirm\('Вы точно хотите удалить уровень\?'\)/,
  'Template editor must use the same in-app dialog');
assert.match(component,/createPortal\(/,
  'Deletion dialog is portaled out of the scrollable PDF editor');
assert.match(component,/role="dialog" aria-modal="true"/);
assert.match(component,/Вы точно хотите удалить уровень\?/);
assert.match(component,/aria-labelledby="pf-level-confirm-title"/);
assert.match(component,/event\.key==='Escape'/);
assert.match(component,/setPendingDelete\(level\)/,
  'Clicking a level star opens the dialog, not immediate deletion');
assert.match(component,/onRemove\(pendingDelete\)/,
  'Data should only be removed after affirmative confirmation');
assert.match(css,/\.pf-advancement-confirm-backdrop/);
assert.match(css,/position:\s*fixed/);
assert.match(css,/place-items:\s*center/);
assert.match(css,/\.pf-advancement::after/);
assert.match(css,/background-image:\s*var\(--pf-page-two-art\)/);
assert.match(css,/width:\s*max\(0px, calc\(1\.25cqw - 5px\)\)/,
  'Trim exactly five pixels from the left of the shield restoration strip');
assert.match(css,/background-position:\s*calc\(1\.25cqw - 66\.25cqw - 5px\) -94cqw/,
  'Cropping must preserve the right edge of the source artwork');
assert.match(css,/transform:translateY\(calc\(-50% - 4px\)\)/,
  'Lift only the plus level control by four pixels');
assert.match(sheet,/onAdd=\{\(\)=>setValues\(old=>addAdvancementLevel\(old\)\)\}/);
assert.match(admin,/page===2 && <DynamicAdvancement/,'editor and sheet use one renderer');
assert.match(admin,/page!==2\|\|!isAdvancementField\(f.id\)/);
assert.match(admin,/previewAdvancementCount/);
const savePart=admin.slice(admin.indexOf('async function save()'),admin.indexOf('async function publish()'));
assert.doesNotMatch(savePart,/previewAdvancementCount|displaySamples|samples/);

// Regression: the right column must keep the *original PDF geometry*.
// Previously the image used height:100% of an expanding page and stretched
// inventory, labels and equipment boxes vertically.
for(const componentSource of [sheet,admin]) {
  assert.match(componentSource,/className="pf-advancement-fixed-art"/,
    'page two needs a fixed-size art and field coordinate wrapper');
  assert.match(componentSource,/pageArtUrl=/,
    'the native Pathfinder art must be available for original heading fonts');
}
assert.match(sheet,/isAdvancementPage\s*\?\s*<div className="pf-advancement-fixed-art"/);
assert.match(admin,/page===2\s*\?\s*<div className="pf-advancement-fixed-art"/);
assert.match(css,/aspect-ratio:\s*600\.945\s*\/\s*782\.362/,
  'the PDF art layer needs the source page aspect ratio');
assert.match(css,/\.pf-advancement-fixed-art > img\s*\{/,
  'background image must be limited to the fixed artwork box');
assert.match(css,/height:\s*100%\s*!important/,
  'bitmap may fill only fixed artwork, not growing page');
assert.match(css,/object-fit:\s*fill/);
assert.match(css,/background-image:\s*var\(--pf-page-two-art\)/,
  'native PF2e heading art replaces the browser heading');
assert.match(css,/\.pf-sheet-page-advancement > \.pf-advancement/,
  'dynamic section must participate in document height');
assert.match(css,/\.pf-advancement-fixed-art > \.pf-field/,
  'inventory inputs keep their PDF coordinate origin');
assert.match(css,/\.pf-advancement-fixed-art > \.ta-field/,
  'admin inventory field handles keep their PDF coordinate origin');

// The page itself is a size-query container. Applying cqw to its own
// min-height uses the VIEWPORT width, not the 600.945pt PDF width.
// Only the inner advancement section may use 130.19cqw for the page baseline.
const pageSizeRules=[...css.matchAll(/\.pf-sheet-page\.pf-sheet-page-advancement,\s*\.ta-page\.ta-page-advancement\s*\{([^}]*)\}/g)];
assert.equal(pageSizeRules.length,2);
assert.ok(pageSizeRules.every(([,body])=>/min-height:\s*0;/.test(body)),
  'Both outer page rules must avoid viewport-relative cqw heights');
assert.ok(pageSizeRules.every(([,body])=>!/min-height:\s*130\.19cqw/.test(body)));
assert.match(css,/\.pf-sheet-page-advancement > \.pf-advancement,[\s\S]*?min-height:\s*130\.19cqw;/,
  'Keep the same original PDF height when only short levels are present');
const appSource=read('../src/App.tsx');
assert.match(appSource,/pathfinder\/portrait-placeholder-simple\.png/,
  'Empty PF2e character card uses the user-supplied portrait icon');
const simplePortrait=readFileSync(new URL('../public/pathfinder/portrait-placeholder-simple.png',import.meta.url));
assert.deepEqual([...simplePortrait.subarray(0,8)],[137,80,78,71,13,10,26,10],'Portrait placeholder must be a valid PNG');
assert.equal(simplePortrait.readUInt32BE(16),200);
assert.equal(simplePortrait.readUInt32BE(20),200);

console.log('PF2e advancement: one required level, add/remove/compact, placeholders and growing page shared by admin/live.');
