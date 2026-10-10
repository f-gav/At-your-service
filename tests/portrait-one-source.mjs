import assert from 'node:assert/strict';
import fs from 'node:fs';
import {frameFromCrop,frameStyle,validCrops} from '../src/features/portrait/crop.ts';

const size={width:1400,height:1000};
const square=frameFromCrop(size,{width:300,height:300},{zoom:1.4,dx:30,dy:-20});
const sheet=frameFromCrop(size,{width:300,height:442.5},{zoom:1.1,dx:-40,dy:10});
const pair={card:square,sheet};
assert.ok(validCrops(pair));
assert.notDeepEqual(square,sheet);
for(const f of [square,sheet]){
  assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=1.002&&f.y+f.h<=1.002);
  const style=frameStyle(f);
  assert.equal(style.position,'absolute');
  assert.match(style.width,/\%$/);
  assert.match(style.top,/\%$/);
}
assert.equal(validCrops({card:{x:0,y:0,w:2,h:1},sheet}),false);
assert.equal(validCrops({card:square}),false);

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const editor=read('../src/features/portrait/PortraitEditor.tsx');
const storage=read('../src/features/portrait/portrait-storage.ts');
const json=read('../src/features/portrait/portrait-json.ts');
const character=read('../src/lib/character-json.ts');
const app=read('../src/App.tsx');
const preview=read('../src/features/pathfinder/TemplateAdmin.tsx');
const css=read('../src/features/pathfinder/TemplateAdmin.css');
const sheetSource=read('../src/features/pathfinder/PathfinderSheet.tsx');
const migration=read('../supabase/migrations/20261010_one_source_portrait_with_crop_frames.sql');

assert.match(editor,/optimizedSourceWebp\(img\)/);
assert.match(editor,/frameFromCrop\(sourceSize/);
assert.match(storage,/portrait_source_path:path/);
assert.match(storage,/portrait_crops:crops/);
assert.match(storage,/saveLegacyPortrait/);
assert.match(json,/type:'source'/);
assert.match(json,/type:'legacy'/);
assert.match(json,/crops:c\.portrait_crops/);
assert.match(character,/parsePortraitTransfer/);
assert.match(app,/saveLegacyPortrait/);
assert.match(app,/portrait_source_path, portrait_crops/);
assert.match(sheetSource,/portraitFrame/);
assert.match(preview,/ta-preview-control/);
assert.match(preview,/className=\{'ta-preview-control '/);
assert.match(css,/\.ta-page \{container-type:inline-size;\}/);
assert.match(migration,/source[.]webp/);
console.log('One-source portraits, independent crop frames, legacy JSON, live-metric editor preview passed.');
