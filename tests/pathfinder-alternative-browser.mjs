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
    const ebbeLoaded=await page.evaluate(async()=>{
      await document.fonts.load('900 14px "PF2e Ebbe Black"','БЛАНК ПЕРСОНАЖА');
      const title=document.querySelector('.pf-alt-p1-logo span');
      const heading=document.querySelector('.pf-alt-p1-heading');
      return document.fonts.check('900 14px "PF2e Ebbe Black"','БЛАНК ПЕРСОНАЖА')&&
        !!title&&!!heading&&getComputedStyle(title).fontFamily.includes('PF2e Ebbe Black')&&
        getComputedStyle(heading).fontFamily.includes('PF2e Ebbe Black');
    });
    assert.ok(ebbeLoaded,'Ebbe Black Cyrillic webfont must load and style the Pathfinder headings');
    const metrics=await page.evaluate(()=>{
      const out=[];
      for(const page of document.querySelectorAll('.pf-alt-page')){
        const rect=page.getBoundingClientRect();
        const offenders=[...page.querySelectorAll('*')].filter(el=>{
          if(!(el instanceof HTMLElement))return false;
          const elRect=el.getBoundingClientRect();
          if(!elRect.width||!elRect.height)return false;
          return elRect.right>rect.right+3 || elRect.left<rect.left-3;
        }).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,
          parent:el.parentElement?.className,aria:el.getAttribute('aria-label'),
          txt:(el.textContent||'').trim().slice(0,32),
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
      const first=pages.first();
      assert.equal(await first.locator('.pf-alt-p1-logo').count(),1,'PF logo is placed above the first page');
      assert.equal(await first.locator('.pf-alt-p1-origins>section').count(),3,'Ancestry, background and class share one row');
      assert.equal(await first.locator('.pf-alt-p1-utility>.pf-alt-section').count(),3,'Languages, perception and speed share one row');
      await first.screenshot({path:'test-artifacts/pf-alt-1440-page-1-base.png'});
    }
    if(width===1440){
      const first=pages.nth(0),fourth=pages.nth(3);
      const name=first.getByRole('textbox',{name:'Имя персонажа'});
      await name.fill('Изменённый герой');
      assert.equal(await name.inputValue(),'Изменённый герой','HTML input remains editable');
      const hero=first.getByRole('button',{name:'Пункт героизма 1'});
      const before=await hero.getAttribute('aria-pressed');
      await hero.click();
      assert.notEqual(await hero.getAttribute('aria-pressed'),before,'Printed hero hexagon toggles');
      const dying=first.locator('.pf-alt-dying-skulls button');
      assert.equal(await dying.count(),4,'All four death skulls remain interactive');
      await dying.nth(2).click();
      assert.equal(await dying.filter({has:page.locator('svg')}).count(),4);
      assert.equal(await dying.nth(2).getAttribute('aria-pressed'),'true');
      const rankSquares=first.locator('.pf-alt-skill-row').first().locator('.pf-alt-rank-square');
      assert.equal(await rankSquares.count(),4,'A skill shows four rank squares, never a dropdown');
      const initialRank=await rankSquares.evaluateAll(nodes=>nodes.findIndex(node=>node.getAttribute('aria-pressed')==='true'));
      await rankSquares.nth(2).click();
      assert.equal(await rankSquares.nth(2).getAttribute('aria-pressed'),'true','Master square selects rank 3');
      assert.equal(await rankSquares.filter({hasText:'✓'}).count(),1,'Only one rank may be selected at a time');
      await rankSquares.nth(2).click();
      assert.equal(await rankSquares.filter({hasText:'✓'}).count(),0,'Click selected square to return to untrained');
      assert.equal(await first.locator('.pf-alt-skill-row select').count(),0,'No dropdowns for skill ranks');
      const weapon=first.locator('.pf-alt-weapon').first();
      assert.equal(await weapon.locator('.pf-alt-weapon-core input').count(),4,
        'Each weapon has four compact print fields');
      await weapon.getByText('Бонусы и дополнительные свойства').click();
      assert.ok(await weapon.locator('.pf-alt-weapon-extra input').count()>0,
        'Advanced weapon fields remain editable when expanded');
      assert.equal(await first.locator('.pf-alt-skill-head').count(),1,
        'The skill table has one fixed heading row, not repeated column labels');
      assert.equal(await fourth.locator('.pf-alt-manual-column').count()>=2,true,
        'The manual spell list uses adjacent ruled input columns');
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
