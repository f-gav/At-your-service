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
}finally{await browser.close();await new Promise(r=>server.close(r));}
