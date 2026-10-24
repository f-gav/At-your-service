import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const root=resolve('dist');
const server=createServer(async(req,res)=>{
 let path=new URL(req.url,'http://localhost').pathname.replace(/^\/At-your-service\//,'');
 if(!path)path='index.html';
 else if(!extname(path))path=path.replace(/\/?$/,'/')+'index.html';
 try{const data=await readFile(resolve(root,path));res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);}
 catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(resolve(root,'404.html')));}
});
await new Promise(r=>server.listen(4196,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const base='http://127.0.0.1:4196/At-your-service/';
 const character='character/550e8400-e29b-41d4-a716-446655440000/';
 await page.goto(base+character+'?source=shared',{waitUntil:'networkidle'});
 await page.waitForURL(url=>url.pathname==='/At-your-service/'+character);
 assert.equal(new URL(page.url()).search,'?source=shared');
 assert.equal(new URL(page.url()).hash,'');
 await page.goto(base+'library/',{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Библиотека заклинаний'}).waitFor();
 await page.reload({waitUntil:'networkidle'});
 assert.equal(new URL(page.url()).hash,'');
 await page.goto(base+'#library',{waitUntil:'networkidle'});
 await page.waitForURL(url=>url.pathname==='/At-your-service/library/'&&url.hash==='');
 console.log('PASS: production static paths, character 404 recovery, query preservation, legacy links and library refresh');
 // Production UI: dark appearance is independent from any saved character data.
 await page.goto(base,{waitUntil:'networkidle'});
 const darkButton=page.getByRole('button',{name:'Включить тёмную тему'});
 await darkButton.click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'dark');
 assert.equal(await page.evaluate(()=>localStorage.getItem('ays-site-theme')),'dark');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'dark');
 const night=await page.evaluate(()=>({
   background:getComputedStyle(document.documentElement).backgroundColor,
   header:getComputedStyle(document.querySelector('.site-header')).backgroundColor
 }));
 assert.equal(night.background,'rgb(13, 15, 21)','WreckTrack-blue night background');
 assert.equal(night.header,'rgb(15, 16, 21)','Dark app header');
 // WreckTrack reference: atmospheric gradients and graphite cards; no obsolete eyebrow.
 const wrecktrackStyle=await page.evaluate(()=>{
   const home=document.querySelector('.page-home');
   const card=document.createElement('div');
   card.className='character-card';
   home.append(card);
   const style={
     shellBackground:getComputedStyle(document.querySelector('.site-shell')).backgroundImage,
     cardBackground:getComputedStyle(card).backgroundImage,
     cardBorder:getComputedStyle(card).borderColor,
     hasObsoleteEyebrow:!!home.querySelector('.hero-eyebrow'),
   };
   card.remove();
   return style;
 });
 assert.match(wrecktrackStyle.shellBackground,/radial-gradient/,
   'Night mode should have an atmospheric blue-black backdrop');
 assert.match(wrecktrackStyle.cardBackground,/linear-gradient/,
   'Night character cards should have soft graphite gradients');
 assert.equal(wrecktrackStyle.cardBorder,'rgb(54, 56, 67)');
 assert.equal(wrecktrackStyle.hasObsoleteEyebrow,false,'Home hero must not show the removed platform eyebrow');
 const paperColors=await page.evaluate(()=>{
   const samples=['pf-sheet-page','pf-alt-page','moon-paper'];
   return samples.map(name=>{
     const element=document.createElement('article');
     element.className=name;
     document.body.append(element);
     const styles=getComputedStyle(element);
     const color={name,background:styles.backgroundColor,scheme:styles.colorScheme};
     element.remove();
     return color;
   });
 });
 for(const sample of paperColors){
   assert.equal(sample.background,'rgb(255, 255, 255)',sample.name+' stays white');
   assert.equal(sample.scheme,'light',sample.name+' keeps light native controls');
 }
 // Check actual computed CSS of the editor controls in the production bundle.
 const captureEditorChrome=()=>page.evaluate(()=>{
   const host=document.createElement('div');
   host.innerHTML=`
     <main class="page pf-editor">
       <div class="pf-toolbar">
         <div class="pf-alt-variant-picker">
           <button>Классический PF2e</button>
           <button aria-pressed="true">Альтернативный PF2e</button>
         </div>
         <button class="sheet-pdf-export-tab">PDF</button>
         <button class="pf-settings-button">Настройки</button>
         <div class="pf-settings-popover"><span>Опции</span></div>
       </div>
       <nav class="pf-navigation-help">
         <button class="pf-navigation-help-link pf-navigation-help-active">Страница</button>
       </nav>
       <article class="pf-sheet-page"></article>
     </main>
     <main class="page moon-editor">
       <div class="moon-tabs"><button class="moon-tab moon-tab-active">Досье</button></div>
       <article class="moon-paper"></article>
     </main>`;
   document.body.append(host);
   const color=selector=>getComputedStyle(host.querySelector(selector)).backgroundColor;
   const result={
     variant:color('.pf-alt-variant-picker'),
     activeVariant:color('.pf-alt-variant-picker button[aria-pressed="true"]'),
     pdf:color('.sheet-pdf-export-tab'),
     settings:color('.pf-settings-popover'),
     nav:color('.pf-navigation-help'),
     activeNav:color('.pf-navigation-help-active'),
     moonTab:color('.moon-tab-active'),
     pfPaper:color('.pf-sheet-page'),
     moonPaper:color('.moon-paper'),
   };
   host.remove();
   return result;
 });
 const darkChrome=await captureEditorChrome();
 assert.deepEqual(darkChrome,{
   variant:'rgb(26, 27, 36)',
   activeVariant:'rgb(49, 93, 145)',
   pdf:'rgb(28, 39, 54)',
   settings:'rgb(26, 27, 36)',
   nav:'rgb(26, 27, 36)',
   activeNav:'rgb(38, 60, 86)',
   moonTab:'rgb(38, 60, 86)',
   pfPaper:'rgb(255, 255, 255)',
   moonPaper:'rgb(255, 255, 255)',
 },'Dark-theme editor buttons and navigators must be blue; character sheets remain white');
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'dark',
   'Saved appearance must be active after reloading, before clicking any UI');
 await page.getByRole('button',{name:'Включить светлую тему'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ays-site-theme')),'light');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'light');
 assert.equal(await page.locator('.hero-eyebrow').count(),0,
   'Removed homepage eyebrow must be absent in light and dark themes');
 const lightChrome=await captureEditorChrome();
 for(const key of ['variant','activeVariant','pdf','settings','nav','activeNav','moonTab']){
   assert.notEqual(lightChrome[key],darkChrome[key],key+' must return to light appearance');
 }
 await page.setViewportSize({width:390,height:800});
 const mobileToggle=page.getByRole('button',{name:'Включить тёмную тему'});
 const mobileBounds=await mobileToggle.boundingBox();
 assert.ok(mobileBounds&&mobileBounds.x>=0&&mobileBounds.x+mobileBounds.width<=390,
   'Mobile theme toggle must remain within viewport');
 await mobileToggle.click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'dark');
 console.log('PASS: persistent WreckTrack-blue appearance, mobile toggle, and white character-sheet paper');
}finally{await browser.close();await new Promise(r=>server.close(r));}
