import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port='4205';
const origin='http://127.0.0.1:'+port+'/At-your-service/tests/pdf-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',
  env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try{if((await fetch(origin)).ok){ready=true;break;}}catch{/* startup */}
    await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(ready,'Mobile sheet fixture not ready');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [320,390,660,1360]){
    for(const system of ['prmoon','pf2e']){
      const page=await browser.newPage({viewport:{width,height:820}});
      const errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      try {
        await page.goto(origin+'?system='+system+'&inventory=1',{waitUntil:'networkidle'});
        const selector=system==='prmoon'?'.moon-paper':'.pf-sheet-page';
        await page.locator(selector).first().waitFor();
        const measurements=await page.evaluate(({system,selector})=>{
          const paper=document.querySelector(selector);
          const viewport=system==='prmoon'?document.querySelector('.moon-sheet-scroll'):
            document.querySelector('.pf-sheet-scroll');
          const box=paper.getBoundingClientRect();
          const scroller=viewport.getBoundingClientRect();
          const get=s=>document.querySelector(s)?getComputedStyle(document.querySelector(s)).gridTemplateColumns:null;
          return {paperWidth:box.width,scrollerWidth:scroller.width,scrollWidth:viewport.scrollWidth,
            pageOverflow:document.documentElement.scrollWidth-window.innerWidth,
            columns:system==='prmoon'?{
              about:get('.moon-about-duo'),combat:get('.moon-combat-fields'),
              resources:get('.moon-resources'),inventory:get('.moon-inventory-grid')
            }:{}};
        },{system,selector});
        if(width<=660){
          assert.ok(measurements.paperWidth>=790,
            system+' paper shrank on '+width+'px mobile: '+JSON.stringify(measurements));
          assert.ok(measurements.scrollWidth>measurements.scrollerWidth,
            system+' sheet must pan within its own viewport');
          if(system==='prmoon'){
            const count=s=>s.trim().split(/\s+/).length;
            for(const [name,n] of [['about',2],['combat',7],['resources',4],['inventory',4]]){
              assert.equal(count(measurements.columns[name]),n,
                name+' grid lost its original columns on '+width+'px');
            }
          }
        }
        assert.ok(measurements.pageOverflow<8,
          system+' creates top-level horizontal overflow: '+JSON.stringify(measurements));
        assert.equal(errors.length,0,errors.join('; '));
        console.log('PASS paper geometry',system,width,measurements.paperWidth);
      }finally{await page.close();}
    }
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
