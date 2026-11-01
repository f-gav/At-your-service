import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

// Final release contract. This is a guard against silently dropping a
// previously mandatory integration check in a later refactor.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflow=read('.github/workflows/deploy.yml');
const pkg=JSON.parse(read('package.json'));
const requiredModelTests=[
  'security-stage1.mjs','security-jwt-harness-mock.mjs',
  'rooms.mjs','room-request-guard.mjs','room-rpc-rate-staging.mjs',
  'character-save-conflict.mjs','stage2-draft-recovery.mjs',
  'stage2-sheet-roundtrip.mjs','compatibility-v02.mjs',
  'pathfinder-spellcasting.mjs','pathfinder-alternative.mjs',
  'pathfinder-pages-notes.mjs','project-moon.mjs',
  'project-moon-equipment.mjs','project-moon-inventory.mjs',
  'project-moon-mobile.mjs','auto-save-pwa.mjs',
  'sheet-pdf.mjs','spell-library.mjs','spell-performance.mjs'
];
for(const filename of requiredModelTests){
  assert.ok(existsSync(new URL('../tests/'+filename,import.meta.url)), 'Missing QA test '+filename);
  assert.ok(pkg.scripts['test:models'].includes('tests/'+filename),
    'Model regression no longer runs in mandatory CI: '+filename);
}
const browser=[
  'pdf-browser.mjs','pathfinder-alternative-browser.mjs',
  'spell-library-browser.mjs','routes-static-browser.mjs',
  'theme-layout-browser.mjs','stage2-ux-browser.mjs',
  'stage2-save-browser.mjs','stage2-sheet-reopen-browser.mjs',
  'stage2-mobile-paper-browser.mjs','release-smoke-browser.mjs'
];
for(const filename of browser){
  assert.ok(existsSync(new URL('../tests/'+filename,import.meta.url)), 'Missing Chromium QA: '+filename);
  assert.ok(workflow.includes(filename) || Object.entries(pkg.scripts).some(([name,command])=>workflow.includes('npm run '+name) && command.includes(filename)),
    'Browser test missing from release gate: '+filename);
}
assert.match(workflow,/needs: \[build, rpc-quota-postgres, recovery-windows-smoke\]/);
assert.match(workflow,/if: github\.event_name != 'pull_request'/);
assert.match(workflow,/actions\/deploy-pages@v4/);
assert.match(workflow,/Verify published Rooms release/);
assert.match(workflow,/Verify live Necromancer catalog/);
assert.match(workflow,/tests\/fixtures\/room-rpc-local-schema\.sql/);
assert.ok(!workflow.includes('supabase db push'),'Production schema must not be altered by release CI');
const css=read('src/features/project-moon/ProjectMoonSheet.css');
const sheet=read('src/features/pathfinder/PathfinderSheet.css');
assert.ok(css.includes('Stage 2 / bundle 5: paper geometry'));
assert.ok(sheet.includes('Stage 2 / bundle 5: preserve the coordinate-based original sheet'));
assert.match(css,/\@media print/);
assert.match(sheet,/pf-sheet-scroll/);
console.log('PASS stage 2 final acceptance: models, room/security/SQL, both sheets, JSON, PDF, mobile, save, library, and live release gates retained');
