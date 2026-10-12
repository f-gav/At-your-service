import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyMoonSheet, readMoonSheet, saveMoonSheet, moonDisplayedMax } from '../src/features/project-moon/model.ts';
import { MOON_PAGES } from '../src/features/project-moon/model.ts';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const css = read('../src/features/project-moon/ProjectMoonSheet.css');
const markup = read('../src/features/project-moon/ProjectMoonSheet.tsx');
const app = read('../src/App.tsx');
const json = read('../src/lib/character-json.ts');
const portraits = read('../src/features/portrait/portrait-json.ts');
const docs = read('../docs/PROJECT-MOON-PATCH1.md');

// Mobile overrides MUST come after the original desktop-sized portrait and
// the template-controlled --moon-portrait-shift-y margin. Otherwise the
// published desktop Y adjustment drags the portrait over "PROJECT MOON".
const globalShift = css.indexOf('margin-top:var(--moon-portrait-shift-y,0px)');
const phoneOverride = css.lastIndexOf('@media screen and (max-width: 660px)');
const portraitOverride = css.indexOf('.moon-page-dossier .moon-dossier-top > .moon-portrait-host {', phoneOverride);
assert.ok(globalShift > 0 && phoneOverride > globalShift);
assert.ok(portraitOverride > phoneOverride);
const portraitRule = css.slice(portraitOverride, css.indexOf('}', portraitOverride));
assert.match(portraitRule,/grid-row:\s*1;/);
assert.match(portraitRule,/order:\s*-1;/);
assert.match(portraitRule,/margin:\s*12px auto 4px;/,
  'Phone portrait must ignore potentially negative desktop frame shifts');
assert.ok(!portraitRule.includes('--moon-mask-'),
  "Preserve the user\'s independent mask crop/offset settings");
const dossierFieldRule = css.slice(css.indexOf('.moon-page-dossier .moon-dossier-top > .moon-dossier-fields {', phoneOverride));
assert.ok(dossierFieldRule.includes('grid-row: 2;'),
  'Phone dossier details follow the portrait, not overlay it');
assert.ok(css.includes('min-height: 0; /* only print and desktop keep the original A4 minimum */'));
assert.ok(css.includes('@media screen and (max-width: 360px)'));
assert.ok(css.includes('.moon-resource-controls button {'));
assert.ok(css.includes('.moon-identity-pairs {') && css.includes('grid-template-columns: minmax(0,1fr);'));
assert.ok(css.includes('.moon-weapon-track > .moon-weapon-card { flex: 0 0 100%; }'));
assert.ok(css.includes('.moon-about-info { grid-template-columns: minmax(0,1fr); }'));
assert.ok(css.includes('@media print {') && css.includes('width: 210mm; min-height: 297mm;'),
  'Printed document retains exact A4 page dimensions');
assert.ok(markup.includes('pageOrder.map(page => <article'));
assert.deepEqual(MOON_PAGES.map(x=>x.id), ['dossier','combat','about','notes']);
assert.ok(markup.includes('<MoonPortrait url={portraitUrl}'));
assert.ok(markup.includes('onEditPortrait={previewMode ? undefined : onEditPortrait}'));
assert.ok(markup.includes('Помощь в навигации'));
assert.ok(markup.includes('Страницы листа…'));
assert.ok(markup.includes('moon-weapon-pagination'));

// JSON has always existed in code; verify the published format and the real
// import pathway rather than trusting the historically outdated README.
assert.ok(json.includes("prmoon: 'Project Moon'"));
assert.ok(json.includes("if (system !== 'pf2e' && system !== 'prmoon')"));
assert.ok(json.includes('const moon = details.projectMoonSheet'));
assert.ok(json.includes("c.system === 'prmoon' ? 'PrMoon'"));
assert.ok(json.includes('const portrait = await portraitToJson(c)'));
assert.ok(portraits.includes('source:string;crops:PortraitCrops'));
assert.ok(portraits.includes("type:'legacy'"));
assert.ok(app.includes('parseCharacterJson(await file.text())'));
assert.ok(app.includes('await downloadCharacter(character)'));
assert.ok(app.includes('savePortrait(imported,user.id,parsed.portrait.source,parsed.portrait.crops)'));
assert.ok(docs.includes('**Экспорт и импорт JSON v1 для Pr. Moon**'));
const original = emptyMoonSheet();
original.fields = {occupation:'Синдикат',organization:'Средний палец',rank:'1',inventory:'ays:rich:v1:<div>Меч</div>'};
original.weapons[0].name='Оружие A';
original.skills[0].title='Приём';
original.notes[0].body='История';
original.autoVitals = true;
original.maxOverrides.hp='165';
original.pageOrder = ['notes','dossier','combat','about'];
const saved = saveMoonSheet({otherSystem:'untouched'},original);
const roundTrip = readMoonSheet(JSON.parse(JSON.stringify(saved)));
assert.deepEqual(roundTrip,readMoonSheet(saved),'Pr. Moon character details survive JSON stringify / parse');
assert.equal(saved.otherSystem,'untouched');
assert.equal(moonDisplayedMax(emptyMoonSheet(),'light'),'');
console.log('PASS: responsive Pr. Moon reading layout, safe portrait position, A4 print, JSON and saved-sheet round trip');
