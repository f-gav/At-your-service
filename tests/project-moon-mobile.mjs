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

// Bundle 5: mobile presentation retains fixed paper geometry and pans horizontally.
// Earlier mobile rules may exist, but the final screen-only override wins.
const mobilePaper = css.lastIndexOf('/* Stage 2 / bundle 5: paper geometry');
assert.ok(mobilePaper > 0, 'Mobile paper override must be the last layout patch');
const phoneCss = css.slice(mobilePaper);
assert.match(phoneCss, /@media screen and \\(max-width: 660px\\)/);
assert.match(phoneCss, /overflow-x: auto;/);
assert.match(phoneCss, /width: 794px;/);
assert.match(phoneCss, /min-height: 1123px;/);
assert.match(phoneCss, /moon-two-columns, \\.moon-resistance-layout, \\.moon-about-duo, \\.moon-notes/);
assert.match(phoneCss, /grid-template-columns: repeat\\(2,minmax\\(0,1fr\\)\\)/);
assert.match(phoneCss, /moon-combat-fields \\{ grid-template-columns: repeat\\(7,minmax\\(0,1fr\\)\\)/);
assert.match(phoneCss, /moon-resources \\{ grid-template-columns: repeat\\(4,minmax\\(0,1fr\\)\\)/);
assert.match(phoneCss, /moon-page-dossier \\.moon-dossier-top > \\.moon-portrait-host/);
assert.ok(!phoneCss.includes('--moon-mask-'), 'Do not override portrait mask calibration');
assert.ok(css.includes('@media print {') && css.includes('width: 210mm; min-height: 297mm;'),
  'Print remains exactly A4');
assert.ok(markup.includes('visibleMoonPages.map(page => <article'));
assert.deepEqual(MOON_PAGES.map(x=>x.id), ['dossier','combat','equipment','about','notes']);
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
assert.ok(app.includes('void exportCharacterJson(character)') && app.includes('await downloadCharacter(freshest)'), 'Card menu exports a fresh saved character');
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
