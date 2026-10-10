import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toggleAppearance, TOGGLE_SHAPES, TOGGLE_MODES } from '../src/features/pathfinder/toggle-shapes.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
assert.deepEqual([...TOGGLE_SHAPES], ['rectangle','square','circle','diamond','hexagon']);
assert.deepEqual([...TOGGLE_MODES], ['check','fill']);
// Preserve old records in published templates without adding new keys.
assert.deepEqual(toggleAppearance({id:'hero_1'}),{
  shape:'hexagon',mode:'fill',insetX:12,insetY:16,
});
assert.deepEqual(toggleAppearance({id:'focus_point_1'}),{
  shape:'square',mode:'check',insetX:0,insetY:0,
});
assert.deepEqual(toggleAppearance({
  id:'hero_2',toggleShape:'circle',toggleMode:'check',toggleInsetX:4,toggleInsetY:6,
}),{shape:'circle',mode:'check',insetX:4,insetY:6});

const schema=read('../src/features/pathfinder/editor-schema.ts');
const admin=read('../src/features/pathfinder/TemplateAdmin.tsx');
const app=read('../src/features/pathfinder/PathfinderSheet.tsx');
const styles=read('../src/features/pathfinder/PathfinderSheet.css');
const adminCss=read('../src/features/pathfinder/TemplateAdmin.css');
const model=read('../src/features/pathfinder/layout.ts');
const json=read('../src/lib/character-json.ts');

assert.match(schema,/TOGGLE_SHAPES.includes\(a.toggleShape\)/);
assert.match(schema,/TOGGLE_MODES.includes\(a.toggleMode\)/);
assert.match(schema,/toggleInsetX >= 0 && a.toggleInsetX <= 40/);
assert.match(model,/toggleShape\?:/);
assert.match(admin,/Форма нажимной кнопки/);
assert.match(admin,/Отступ внутри X/);
assert.match(admin,/Быстрый размер/);
assert.match(admin,/toggleAppearance\(active\)/);
assert.match(admin,/ToggleVisual field=\{f\}/);
assert.match(adminCss,/\.ta-field > \.pf-toggle-visual/);
assert.match(app,/ToggleVisual field=\{field\} checked=\{value === true\}/);
assert.match(styles,/\.pf-toggle-visual\[data-shape="diamond"\]/);
assert.match(styles,/\.pf-toggle-visual\[data-shape="hexagon"\]/);
assert.match(styles,/\.pf-toggle-visual\[data-mode="fill"\]\[data-checked="true"\]/);
const visual=read('../src/features/pathfinder/ToggleVisual.tsx');
// Both admin and sheet use this exact renderer; PDF hero ink is dark even
// before selection, so an unchecked hero must mask that dark interior.
assert.match(visual,/data-native-dark-hero=\{isHeroPointId\(field.id\)/);
assert.match(admin,/ToggleVisual field=\{f\} checked=\{samples\[f.id\]==='true'\}/);
assert.match(app,/ToggleVisual field=\{field\} checked=\{value === true\}/);
const maskSelector=String.raw\`.pf-toggle-visual[data-native-dark-hero="true"][data-mode="fill"][data-checked="false"] .pf-toggle-fill-shape\`;
assert.ok(styles.includes(maskSelector),'Unchecked PDF hero-point ink must be masked in both editor and sheet');
assert.ok(styles.indexOf(maskSelector)>styles.indexOf('[data-editor-guide="true"][data-checked="false"]'),
  'Hero mask must override the editor-only guide tint');
assert.match(styles,/background:\s*#fff;/);
assert.match(styles,/\[data-mode="fill"\]\[data-checked="true"\] \.pf-toggle-fill-shape\s*\{[\s\S]*?background:\s*#283136/);

assert.doesNotMatch(styles,/\.pf-portrait-button:hover\s*\{/);
assert.match(styles,/\.pf-portrait-button:focus-visible/);
// Shape is template presentation metadata; no modification to JSON v1 character values.
assert.match(json,/version: 1/);
console.log('Toggle geometry, shape preview, legacy behavior, portrait hover and JSON v1 preserved.');
