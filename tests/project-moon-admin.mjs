import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_MOON_LAYOUT, MOON_LAYOUT_CONTROLS, MOON_TEXT_GROUPS,
  encodeMoonLayout, parseMoonLayout, moonLayoutVariables,
} from '../src/features/project-moon/layout-settings.ts';
const load = path => readFileSync(new URL(path,import.meta.url),'utf8');
const original = {...DEFAULT_MOON_LAYOUT};
const payload = encodeMoonLayout(original);
assert.equal(payload.length,17);
assert.deepEqual(parseMoonLayout(payload),original);
assert.deepEqual(parseMoonLayout(null),original);
const resizedTextLayout={...original,elementStyles:{
  'moon-page-notes|bodyText:0':{...original.textStyles.bodyText,size:16,boxWidth:420,boxHeight:175},
  'moon-page-notes|bodyText:1':{...original.textStyles.bodyText,size:11,boxWidth:250,boxHeight:90},
}};
const resizedRestored=parseMoonLayout(encodeMoonLayout(resizedTextLayout));
assert.equal(resizedRestored.elementStyles['moon-page-notes|bodyText:0'].boxWidth,420,
  'Selected text box width must survive save/reload');
assert.equal(resizedRestored.elementStyles['moon-page-notes|bodyText:0'].boxHeight,175,
  'Selected text box height must survive save/reload');
assert.equal(resizedRestored.elementStyles['moon-page-notes|bodyText:1'].boxWidth,250,
  'Neighbouring text block geometry remains independent');
assert.equal(resizedRestored.textStyles.bodyText.size,original.textStyles.bodyText.size,
  'Individual styling must not change the shared style');

assert.equal(parseMoonLayout([{id:'pagePadding',value:999}]).pagePadding,999);
assert.equal(parseMoonLayout([{id:'titleFont',value:-500}]).titleFont,-500);
assert.equal(parseMoonLayout([{id:'lineColor',value:'red'}]).lineColor,original.lineColor);
assert.equal(parseMoonLayout([{id:'inkColor',value:'#123abc'}]).inkColor,'#123abc');
assert.equal(parseMoonLayout([{id:'sectionGap',value:'120'}]).sectionGap,original.sectionGap);
assert.equal(MOON_LAYOUT_CONTROLS.length,payload.length-2);
const vars = moonLayoutVariables(original);
assert.equal(vars['--moon-page-padding'],'11mm');
assert.equal(vars['--moon-title-size'],'26px');
assert.equal(vars['--moon-line'],'#bfc4c8');
assert.equal(vars['--moon-type-sectionTitle-size'],'13px');
assert.equal(vars['--moon-type-sectionTitle-weight'],'800');
assert.equal(vars['--moon-type-bodyText-family'],"'DejaVu Sans','Noto Sans',Arial,sans-serif");
assert.equal(MOON_TEXT_GROUPS.length,11);
assert.equal(vars['--moon-portrait-width'],'170px');
assert.equal(vars['--moon-portrait-shift-x'],'7px');
assert.equal(vars['--moon-mask-width'],'98%');
assert.equal(vars['--moon-mask-height'],'98%');
assert.equal(vars['--moon-mask-shift-x'],'-2px');
assert.equal(vars['--moon-mask-shift-y'],'2px');
assert.equal(parseMoonLayout([{id:'portraitWidth',value:9999}]).portraitWidth,9999);
const extremeShifts = parseMoonLayout([{id:'portraitShiftX',value:758},{id:'portraitShiftY',value:-1250}]);
assert.equal(extremeShifts.portraitShiftX,758);
assert.equal(extremeShifts.portraitShiftY,-1250);
assert.deepEqual(parseMoonLayout(encodeMoonLayout(extremeShifts)),extremeShifts);
assert.equal(moonLayoutVariables(extremeShifts)['--moon-portrait-shift-y'],'-1250px');
const adjustedMask = parseMoonLayout([
  {id:'portraitWidth',value:226},
  {id:'portraitShiftX',value:12},
  {id:'maskWidth',value:107},
  {id:'maskHeight',value:93},
  {id:'maskShiftX',value:46},
  {id:'maskShiftY',value:-324},
]);
assert.equal(adjustedMask.portraitWidth,226);
assert.equal(adjustedMask.portraitShiftX,12);
assert.equal(adjustedMask.maskWidth,107);
assert.equal(adjustedMask.maskHeight,93);
assert.equal(adjustedMask.maskShiftX,46);
assert.equal(adjustedMask.maskShiftY,-324);
assert.deepEqual(parseMoonLayout(encodeMoonLayout(adjustedMask)),adjustedMask,
  'Frame and mask geometry must survive independent save and reload');
const independentVars=moonLayoutVariables(adjustedMask);
assert.equal(independentVars['--moon-portrait-width'],'226px');
assert.equal(independentVars['--moon-portrait-shift-x'],'12px');
assert.equal(independentVars['--moon-mask-width'],'107%');
assert.equal(independentVars['--moon-mask-height'],'93%');
assert.equal(independentVars['--moon-mask-shift-x'],'46px');
assert.equal(independentVars['--moon-mask-shift-y'],'-324px');
const previousTemplate = parseMoonLayout(payload.filter(item =>
  !['maskWidth','maskHeight','maskShiftX','maskShiftY'].includes(item.id)));
assert.equal(previousTemplate.maskWidth,98);
assert.equal(previousTemplate.maskHeight,98);
assert.equal(previousTemplate.maskShiftX,-2);
assert.equal(previousTemplate.maskShiftY,2);

const oldLayout = parseMoonLayout(payload.slice(0,-1));
assert.deepEqual(oldLayout.textStyles,DEFAULT_MOON_LAYOUT.textStyles,'Old 11-field drafts should have sane typography defaults');
const customized = parseMoonLayout([
  ...payload.filter(entry=>entry.id!=='textStyles'),
  {id:'textStyles',value:{
    sectionTitle:{size:19,weight:650,italic:true,lineHeight:1.6,letterSpacing:1.2,family:'serif',align:'center'},
    bodyText:{size:14,weight:600,italic:false,lineHeight:2.1,letterSpacing:-.5,family:'mono',align:'right'},
    characterName:{size:20,weight:700,italic:true,family:'serif'},
  }},
]);
assert.equal(customized.textStyles.sectionTitle.size,19);
assert.equal(customized.textStyles.sectionTitle.weight,700,'Weight snaps to 100s');
assert.equal(customized.textStyles.sectionTitle.italic,true);
assert.equal(customized.textStyles.sectionTitle.align,'center');
assert.equal(customized.textStyles.bodyText.family,'mono');
assert.equal(customized.textStyles.bodyText.letterSpacing,-.5);
assert.equal(customized.textStyles.characterName.size,20);
assert.deepEqual(parseMoonLayout(encodeMoonLayout(customized)),customized,'Typography survives publish/load');
assert.equal(moonLayoutVariables(customized)['--moon-type-sectionTitle-align'],'center');
assert.equal(moonLayoutVariables(customized)['--moon-type-bodyText-size'],'14px');
const invalidStyles = parseMoonLayout([{id:'textStyles',value:{
  sectionTitle:{size:Infinity,weight:-300,family:'url(unsafe)',italic:'yes',align:'unsafe'},
}}]);
assert.equal(invalidStyles.textStyles.sectionTitle.size,13);
assert.equal(invalidStyles.textStyles.sectionTitle.weight,100);
assert.equal(invalidStyles.textStyles.sectionTitle.family,'sans');
assert.equal(invalidStyles.textStyles.sectionTitle.italic,false);
assert.equal(invalidStyles.textStyles.sectionTitle.align,'left');
assert.equal(customized.textStyles.pageTitle.size,customized.titleFont);
const app = load('../src/App.tsx');
const chooser = load('../src/features/sheet-admin/SheetAdmin.tsx');
const editor = load('../src/features/project-moon/MoonLayoutAdmin.tsx');
const sheet = load('../src/features/project-moon/ProjectMoonSheet.tsx');
const moonCSS = load('../src/features/project-moon/ProjectMoonSheet.css');
const genericCSS = load('../src/styles.css');
const resourceCSS = load('../src/features/pathfinder/ResourceDialog.css');
const pfAdmin = load('../src/features/pathfinder/TemplateAdmin.tsx');
const migration = load('../supabase/migrations/20261012_project_moon_template_editor.sql');
assert.ok(app.includes('<SheetAdmin userId={user.id}'));
assert.ok(chooser.includes("system === 'pf2e'"));
assert.ok(chooser.includes("system === 'prmoon'"));
assert.ok(chooser.includes('key ==='));
assert.ok(chooser.includes('disabled={!active}'));
assert.ok(pfAdmin.includes('backLabel'));
assert.ok(editor.includes('sheet_template_drafts'));
assert.ok(editor.includes("supabase.rpc('publish_sheet_template'"));
assert.ok(editor.includes('sheet_template_history'));
assert.ok(editor.includes('layoutOverride={layout}'));
assert.ok(editor.includes('selectedTextGroup'));
assert.ok(editor.includes('changeTextStyle('));
assert.ok(editor.includes('MOON_TEXT_GROUPS.map('));
assert.ok(editor.includes('Межбуквенный интервал'));
assert.ok(editor.includes('Межстрочный интервал'));
assert.ok(editor.includes('Жирность'));
assert.ok(editor.includes('Шрифт'));
assert.ok(editor.includes('Курсив'));
assert.ok(editor.includes('isMoonPortraitShift(option.key)'));
assert.ok(editor.includes('frameControls.map(renderControl)'));
assert.ok(editor.includes('maskControls.map(renderControl)'));
assert.ok(editor.includes('Сбросить только маску'));
assert.ok(editor.includes('Настройки маски портрета'));
assert.ok(editor.includes('Настройки рамки портрета'));
assert.ok(editor.includes('min={isMoonPortraitShift(option.key) ? undefined : option.min}'));
assert.ok(editor.includes('max={isMoonPortraitShift(option.key) ? undefined : option.max}'));
assert.ok(sheet.includes('layoutOverride ?? DEFAULT_MOON_LAYOUT'));
assert.ok(!sheet.includes('setPublishedLayout('),'Normal sheet must never swap layout after initial paint');
assert.ok(!sheet.includes("from('sheet_templates')"),'Normal sheet reads canonical layout from bundled code');
assert.ok(!sheet.includes("eq('template_key', MOON_LAYOUT_KEY)"), 'Canonical live sheet no longer fetches alternative layout');
assert.ok(moonCSS.includes('var(--moon-page-padding'));
assert.ok(moonCSS.includes('min-height: 297mm'));
assert.ok(moonCSS.includes('var(--moon-type-fieldLabel-size'));
assert.ok(moonCSS.includes('var(--moon-type-fieldValue-size'));
assert.ok(moonCSS.includes('var(--moon-type-noteTitle-weight'));
assert.ok(moonCSS.includes('var(--moon-type-bodyText-family'));
assert.ok(genericCSS.includes('.character-prmoon .character-system'));
assert.ok(genericCSS.includes('#29445f'));
assert.ok(resourceCSS.includes('.pf-resource-danger:hover'));
assert.ok(resourceCSS.includes('color: #fff'));
assert.ok(migration.includes("'pf2e', 'prmoon'"));
assert.ok(migration.includes('sheet_admins'));
const typeMigration=load('../supabase/migrations/20261012_prmoon_typography_controls.sql');
assert.ok(typeMigration.includes('jsonb_array_length(draft_fields) not in (8,11,12)'));
assert.ok(typeMigration.includes("'textStyles'"));
const maskMigration=load('../supabase/migrations/20261012_prmoon_independent_mask_controls.sql');
assert.ok(maskMigration.includes('jsonb_array_length(draft_fields) not in (8,11,12,16)'));
for(const field of ['maskWidth','maskHeight','maskShiftX','maskShiftY'])
  assert.ok(maskMigration.includes("'"+field+"'"));
console.log('PASS: selectable sheet admin, Moon HTML layout publishing, safe config and both UI fixes');
