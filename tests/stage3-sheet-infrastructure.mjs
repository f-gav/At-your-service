import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pf=read('src/features/pathfinder/PathfinderSheet.tsx');
const moon=read('src/features/project-moon/ProjectMoonSheet.tsx');
const hook=read('src/lib/use-sheet-pdf-export.ts');
for(const [label,sheet,system] of [['Pathfinder',pf,'pf2e'],['Project Moon',moon,'prmoon']]){
  assert.ok(sheet.includes(`useSheetPdfExport('${system}'`),label+' must use shared exporter');
  assert.ok(sheet.includes('useAutoSave({'),label+' keeps serialized autosave');
  assert.ok(sheet.includes('recoverLocalDraft('),label+' keeps conflict-safe local recovery');
  assert.ok(sheet.includes('AutoSaveStatus'),label+' keeps visible cloud state');
  assert.ok(sheet.includes('DeviceDraftNotice'),label+' keeps device conflict recovery');
  assert.ok(sheet.includes('FloatingPageNavigation'),label+' keeps page navigation');
  assert.ok(!sheet.includes('const pdfInFlight=useRef('),label+' must not duplicate PDF state');
}
for(const invariant of ['pdfInFlight.current','pdfAutoStarted.current','exportRenderedSheetPdf(pdfRoot.current','setPdfError(','setExportingPdf(false)','onAutoExportComplete','window.clearTimeout(timer)','600'])assert.ok(hook.includes(invariant),'PDF lifecycle lost: '+invariant);
assert.ok(hook.includes('nameRef.current()'),'Auto-export must use latest sheet name');
assert.ok(hook.includes('completeRef.current?.()'),'Auto-export must notify caller');
console.log('PASS: shared PDF lifecycle and distinct PF/Moon save, draft, status, navigation contracts');
