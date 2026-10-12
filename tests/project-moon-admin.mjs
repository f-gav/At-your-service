import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_MOON_LAYOUT, MOON_LAYOUT_CONTROLS, MOON_TEXT_GROUPS,
  encodeMoonLayout, parseMoonLayout, moonLayoutVariables,
} from '../src/features/project-moon/layout-settings.ts';
const load = path => readFileSync(new URL(path,import.meta.url),'utf8');
const original = {...DEFAULT_MOON_LAYOUT};
const payload = encodeMoonLayout(original);
assert.equal(payload.length,12);
assert.deepEqual(parseMoonLayout(payload),original);
assert.deepEqual(parseMoonLayout(null),original);
assert.equal(parseMoonLayout([{id:'pagePadding',value:999}]).pagePadding,22);
assert.equal(parseMoonLayout([{id:'titleFont',value:-500}]).titleFont,20);
assert.equal(parseMoonLayout([{id:'lineColor',value:'red'}]).lineColor,original.lineColor);
assert.equal(parseMoonLayout([{id:'inkColor',value:'#123abc'}]).inkColor,'#123abc');
assert.equal(parseMoonLayout([{id:'sectionGap',value:'120'}]).sectionGap,original.sectionGap);
assert.equal(MOON_LAYOUT_CONTROLS.length,payload.length-1);
const vars = moonLayoutVariables(original);
assert.equal(vars['--moon-page-padding'],'11mm');
assert.equal(vars['--moon-title-size'],'26px');
assert.equal(vars['--moon-line'],'#bfc4c8');
assert.equal(vars['--moon-type-sectionTitle-size'],'13px');
assert.equal(vars['--moon-type-sectionTitle-weight'],'800');
assert.equal(vars['--moon-type-bodyText-family'],"'DejaVu Sans','Noto Sans',Arial,sans-serif");
assert.equal(MOON_TEXT_GROUPS.length,11);
assert.equal(vars['--moon-portrait-width'],'210px');
assert.equal(vars['--moon-portrait-shift-x'],'0px');
assert.equal(parseMoonLayout([{id:'portraitWidth',value:9999}]).portraitWidth,270);
const extremeShifts = parseMoonLayout([{id:'portraitShiftX',value:758},{id:'portraitShiftY',value:-1250}]);
assert.equal(extremeShifts.portraitShiftX,758);
assert.equal(extremeShifts.portraitShiftY,-1250);
assert.deepEqual(parseMoonLayout(encodeMoonLayout(extremeShifts)),extremeShifts);
assert.equal(moonLayoutVariables(extremeShifts)['--moon-portrait-shift-y'],'-1250px');

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
assert.ok(editor.includes('isMoonPortraitShift(key)'));
assert.ok(editor.includes('min={isMoonPortraitShift(option.key) ? undefined : option.min}'));
assert.ok(editor.includes('max={isMoonPortraitShift(option.key) ? undefined : option.max}'));
assert.ok(sheet.includes('layoutOverride ?? publishedLayout'));
assert.ok(sheet.includes("eq('template_key', MOON_LAYOUT_KEY)"));
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
console.log('PASS: selectable sheet admin, Moon HTML layout publishing, safe config and both UI fixes');
