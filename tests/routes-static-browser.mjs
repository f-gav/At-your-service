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
 assert.equal(night.header,'rgb(17, 19, 25)','Dark app header');
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
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'dark',
   'Saved appearance must be active after reloading, before clicking any UI');
 await page.getByRole('button',{name:'Включить светлую тему'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ays-site-theme')),'light');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'light');
 await page.setViewportSize({width:390,height:800});
 const mobileToggle=page.getByRole('button',{name:'Включить тёмную тему'});
 await mobileToggle.click();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.aysTheme),'dark');
 const mobileBounds=await mobileToggle.boundingBox();
 assert.ok(mobileBounds.x>=0&&mobileBounds.x+mobileBounds.width<=390,
   'Mobile theme toggle must remain within viewport');
 console.log('PASS: persistent WreckTrack-blue appearance, mobile toggle, and white character-sheet paper');
}finally{await browser.close();await new Promise(r=>server.close(r));}
