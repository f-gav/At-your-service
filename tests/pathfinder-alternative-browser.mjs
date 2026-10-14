import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base='http://127.0.0.1:4184/At-your-service/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port','4184','--strictPort'],{stdio:'ignore',
   env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try {if((await fetch(base+'tests/pdf-harness.html')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Alternative PDF-layout browser harness failed to start');
  await mkdir('test-artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1440,900,430]){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(base+'tests/pdf-harness.html?system=pf2e&variant=alternative',{waitUntil:'networkidle'});
    const pages=page.locator('.pf-alt-page');
    await pages.first().waitFor();
    assert.equal(await pages.count(),4,'All four PF2e HTML pages must render');
    assert.equal(await page.locator('.pf-sheet-page').count(),0,'Classic PDF backgrounds must be absent');
    await page.evaluate(()=>document.fonts.ready);
    const metrics=await page.evaluate(()=>{
      const out=[];
      for(const page of document.querySelectorAll('.pf-alt-page')){
        const rect=page.getBoundingClientRect();
        const offenders=[...page.querySelectorAll('*')].filter(el=>{
          if(!(el instanceof HTMLElement))return false;
          const elRect=el.getBoundingClientRect();
          if(!elRect.width||!elRect.height)return false;
          return elRect.right>rect.right+3 || elRect.left<rect.left-3;
        }).slice(0,8).map(el=>({cls:el.className,txt:(el.textContent||'').trim().slice(0,32),
          right:Math.round(el.getBoundingClientRect().right)}));
        out.push({
          id:page.id,w:Math.round(rect.width),h:Math.round(rect.height),
          scrollW:page.scrollWidth,clientW:page.clientWidth,
          sectionCount:page.querySelectorAll('.pf-alt-section').length,
          overflowing:offenders
        });
      }
      return out;
    });
    console.log('PF2e alternative '+width+'px metrics: '+JSON.stringify(metrics));
    assert.ok(metrics.every(m=>m.sectionCount>=4),'Each page retains its sections');
    // No part of the HTML sheet may be clipped horizontally by its paper boundary.
    assert.ok(metrics.every(m=>m.scrollW<=m.clientW+4),
      'Text inputs/columns must fit inside each HTML page: '+JSON.stringify(metrics.filter(m=>m.scrollW>m.clientW+4)));
    if(width===1440){
      const first=pages.nth(0),fourth=pages.nth(3);
      const name=first.getByRole('textbox',{name:'Имя персонажа'});
      await name.fill('Изменённый герой');
      assert.equal(await name.inputValue(),'Изменённый герой','HTML input remains editable');
      const hero=first.locator('.pf-alt-hero-marks input[type=checkbox]').first();
      const before=await hero.isChecked();
      await hero.click();
      assert.notEqual(await hero.isChecked(),before,'Printed hexagon hero point must toggle');
      const dying=first.locator('.pf-alt-dying-skulls button');
      assert.equal(await dying.count(),4,'All four death skulls remain interactive');
      await dying.nth(2).click();
      assert.equal(await dying.filter({has:page.locator('svg')}).count(),4);
      assert.equal(await dying.nth(2).getAttribute('aria-pressed'),'true');
      const arcane=fourth.getByRole('button',{name:'Мистическая'});
      await arcane.click();
      assert.equal(await arcane.getAttribute('aria-pressed'),'false',
        'Magic tradition selection must toggle off');
      await arcane.click();
      assert.equal(await arcane.getAttribute('aria-pressed'),'true');
      const spellInput=fourth.getByRole('textbox',{name:'Название',exact:false}).first()
        .or(fourth.locator('.pf-alt-spell-text .pf-rich-editable').first());
      assert.ok(await fourth.locator('.pf-alt-magic-layout').count()===1);
    }
    for(let i=0;i<4;i++){
      await pages.nth(i).screenshot({path:'test-artifacts/pf-alt-'+width+'-page-'+(i+1)+'.png'});
    }
    assert.deepEqual(errors,[],'React browser errors must be absent');
    await page.close();
  }
  console.log('PASS: four original-paper PF2e pages, desktop/tablet/mobile, field interactions and screenshot captures');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
