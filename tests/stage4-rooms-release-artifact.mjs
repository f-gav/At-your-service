import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const release=JSON.parse(readFileSync('dist/release.json','utf8'));
const expected=(process.env.GITHUB_SHA||'local').slice(0,12);
assert.equal(release.revision,expected,'release.json must match built commit');
for(const path of ['dist/index.html','dist/rooms/index.html']){
 const html=readFileSync(path,'utf8');
 assert.ok(html.includes('<meta name="ays-build-revision" content="'+expected+'">'),
  path+' has wrong revision marker');
}
console.log('PASS: release.json and both generated HTML entrypoints match '+expected);
