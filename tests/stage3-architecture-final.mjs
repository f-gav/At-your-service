import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,dirname,relative,extname,existsSync} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../src');
const files=[];
function walk(path){for(const name of readdirSync(path)){const full=resolve(path,name);if(statSync(full).isDirectory())walk(full);else if(/\.(?:ts|tsx)$/.test(name))files.push(full);}}walk(root);
const graph=new Map();let edges=0;let unresolved=[];
const parse=/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
for(const file of files){const source=readFileSync(file,'utf8');const neighbors=[];for(const match of source.matchAll(parse)){
 const spec=match[1]??match[2];if(!spec.startsWith('.'))continue;
 const base=resolve(dirname(file),spec);const candidates=[base,base+'.ts',base+'.tsx',resolve(base,'index.ts'),resolve(base,'index.tsx')];
 const dest=candidates.find(p=>existsSync(p)&&/\.(?:ts|tsx)$/.test(p));if(!dest){unresolved.push(relative(root,file)+' -> '+spec);continue;}
 neighbors.push(dest);edges++;
 }graph.set(file,neighbors);
}
assert.deepEqual(unresolved,[],'Broken local TypeScript imports');
const visiting=new Set(),visited=new Set(),stack=[];const cycles=[];
function visit(node){if(visiting.has(node)){const start=stack.indexOf(node);cycles.push([...stack.slice(start),node].map(p=>relative(root,p)).join(' -> '));return;}
 if(visited.has(node))return;visiting.add(node);stack.push(node);for(const dep of graph.get(node)??[])visit(dep);stack.pop();visiting.delete(node);visited.add(node);
}
for(const file of files)visit(file);
assert.deepEqual(cycles,[],'Circular imports in application source');
for(const name of ['RichField.tsx','FloatingPageNavigation.tsx']){
 const legacy=readFileSync(resolve(root,'features/pathfinder',name),'utf8');
 assert.match(legacy,/export \{default\} from '\.\.\/rich-editor\//,'Old editor/navigation paths must only re-export');
}
for(const name of ['RichField.css','FloatingPageNavigation.css']){
 const old=readFileSync(resolve(root,'features/pathfinder',name),'utf8');
 const shared=readFileSync(resolve(root,'features/rich-editor',name),'utf8');
 assert.equal(old,shared,'Legacy and canonical CSS must remain identical until all compatibility consumers migrate: '+name);
}
for(const name of ['ProjectMoonSheet.tsx','MoonEquipmentPage.tsx']){
 const s=readFileSync(resolve(root,'features/project-moon',name),'utf8');
 assert.doesNotMatch(s,/from ['"]\.\.\/pathfinder\/(?:RichField|FloatingPageNavigation)['"]/,'Moon must not depend on PF editor UI');
}
for(const file of ['features/rooms/RoomsHub.tsx','features/spell-library/SpellLibrary.tsx']){
 const source=readFileSync(resolve(root,file),'utf8');
 assert.doesNotMatch(source,/\.from\(['"]game_rooms['"]\)|\.from\(['"]game_room_members['"]\)|\.from\(['"]game_room_rolls['"]\)/,'Room storage must be isolated');
}
console.log('PASS Stage 3 architecture: '+files.length+' TS/TSX files, '+edges+' local import edges, no cycles or missing files, UI boundaries and CSS compatibility');
