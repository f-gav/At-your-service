import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_RESOURCE, normalizeResource,normalizeQuantity,stepResource,restoreResource,resourceMarkup} from '../src/features/pathfinder/resource-widget.ts';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

assert.equal(normalizeQuantity(-5),0);
assert.equal(normalizeQuantity(13.8),13);
assert.equal(normalizeQuantity('invalid'),0);
assert.equal(normalizeQuantity(999999999),999999);
assert.equal(normalizeResource(DEFAULT_RESOURCE).current,1);
assert.deepEqual(normalizeResource({name:'Стрелы',current:4,max:3,recovery:'daily',notes:'Из колчана',showNotes:true}),
 {name:'Стрелы',current:3,max:3,recovery:'daily',notes:'Из колчана',showNotes:true});
assert.equal(normalizeResource({current:50,max:null}).current,50,'Unlimited resource can grow');
assert.equal(normalizeResource({current:50,max:''}).max,null);
assert.equal(normalizeResource({current:0,max:0}).current,0);
assert.equal(normalizeResource({current:2,max:10,recovery:'invalid'}).recovery,'none');
assert.equal(stepResource({...DEFAULT_RESOURCE,current:0},-1).current,0);
assert.equal(stepResource(DEFAULT_RESOURCE,1).current,1,'Capped at max');
assert.equal(stepResource({...DEFAULT_RESOURCE,current:1,max:null},1).current,2);
assert.equal(stepResource({...DEFAULT_RESOURCE,current:1,max:3},1).current,2);
assert.equal(restoreResource({...DEFAULT_RESOURCE,current:0,max:5}).current,5);
assert.equal(restoreResource({...DEFAULT_RESOURCE,current:0,max:null}).current,0,
 'Restoring a resource without a maximum must not invent a target');
const html=resourceMarkup({name:'Вдохновение барда',current:1,max:3,recovery:'daily',notes:'До отдыха',showNotes:true});
for(const part of ['data-pf-resource-widget="1"','data-current="1"','data-max="3"','data-recovery="daily"',
  'data-show-notes="1"','data-pf-resource-action="minus"','data-pf-resource-action="plus"',
  'data-pf-resource-action="info"','data-pf-resource-action="settings"','data-pf-resource-action="restore"'])
 assert.ok(html.includes(part),part);
assert.match(html,/1<span class="pf-resource-max"> \/ 3<\/span>/);
assert.match(html,/Вдохновение барда/);
assert.doesNotMatch(resourceMarkup({name:'<svg onload="alert(1)">'}),/<svg/);
assert.match(resourceMarkup({name:'A" onclick="evil()'}),/data-name="A&quot; onclick=&quot;evil\(\)"/);
assert.doesNotMatch(resourceMarkup({current:4,max:null}),/data-pf-resource-action="restore"/);
assert.doesNotMatch(resourceMarkup({current:4,max:null}),/\/ ∞/);

const codec=read('../src/features/pathfinder/rich-codec.ts');
const editor=read('../src/features/pathfinder/RichField.tsx');
const dialog=read('../src/features/pathfinder/ResourceDialog.tsx');
const css=read('../src/features/pathfinder/ResourceDialog.css');
const richCss=read('../src/features/pathfinder/RichField.css');
assert.match(codec,/el\.dataset\.pfResourceWidget==='1'/);
assert.match(codec,/resourceMarkup\(resourceFromElement\(el\)\)/,
 'Resource state must survive each sanitization and save');
assert.match(editor,/kind==='divider'\?dividerMarkup\(\):resourceMarkup\(\)/);
assert.match(editor,/addBlock\('resource'\)/);
assert.match(editor,/handleResourceAction\(widget/);
assert.match(editor,/stepResource\(current,-1\)/);
assert.match(editor,/stepResource\(current,1\)/);
assert.match(editor,/restoreResource\(current\)/);
assert.match(editor,/setSelectedResource\(widget\)/);
assert.match(editor,/resource=\{resourceFromElement\(selectedResource\)\}/);
assert.match(editor,/replaceResource\(selectedResource,config\)/);
assert.match(dialog,/name:\s*name\.trim\(\)/);
assert.ok(dialog.includes("maximum.trim()===''?null:maximum"));
assert.match(dialog,/10-минутный отдых/);
assert.match(dialog,/Ежедневная подготовка/);
assert.match(dialog,/Показывать заметки по нажатию на значок i/);
assert.match(dialog,/role="dialog" aria-modal="true"/);
assert.match(dialog,/Подтверждение|Удалить ресурс/);
assert.match(css,/\.pf-rich-editable \[data-pf-resource-widget="1"\]/);
assert.match(richCss,/\.pf-rich-editable \[data-pf-divider="1"\][\s\S]*?color:\s*#252a26/);
assert.match(richCss,/\[data-pf-divider-title="1"\][\s\S]*?color:\s*inherit/);
console.log('PF2e named resource: amounts/caps, unlimited, restoration metadata, notes, sanitizer, settings and divider ink.');
