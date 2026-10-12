import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const css = read('../src/styles.css');
const html = read('../index.html');
const icon = readFileSync(new URL('../public/site-icon.png', import.meta.url));

assert.deepEqual([...icon.subarray(0,8)],[137,80,78,71,13,10,26,10], 'PNG signature');
assert.ok(statSync(new URL('../public/site-icon.png', import.meta.url)).size > 1000);
assert.ok(app.includes('className="brand-icon"'));
assert.ok(app.includes('site-icon.png'));
assert.ok(app.includes('className="brand-wordmark"'), 'Keep the existing wordmark');
assert.ok(!app.includes('className="brand-symbol"'));
assert.ok(css.includes('.brand-icon {'));
assert.ok(!css.includes('.brand-symbol-mark'));
assert.ok(html.includes('rel="icon" type="image/png" sizes="128x128"'));
assert.ok(html.includes('%BASE_URL%site-icon.png?v=1'));
assert.ok(html.includes('rel="apple-touch-icon"'));
assert.ok(!html.includes('href="%BASE_URL%favicon.svg"'));
console.log('PASS: header brand and browser tab use the supplied theatrical mask icon');
