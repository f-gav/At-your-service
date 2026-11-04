import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port='4214';
const origin='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-classic2014-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--port',port,'--strictPort'],{stdio:'ignore',
  env:{...process.env,VITE_BASE_PATH:'/At-your-service/',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''}});
let browser;
try{
  let ready=false;
  for(let i=0;i<90;i++){
    try{if((await fetch(origin)).ok){ready=true;break;}}catch{/* startup */}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'D&D 2014 browser harness did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [320,390,768,1360]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.locator('.dnd14-paper').first().waitFor();
      assert.equal(await page.locator('.dnd14-paper').count(),4,'Exactly four classic pages');
      for(let n=1;n<=4;n++)
        assert.equal(await page.locator('#dnd14-page-'+n).count(),1,'Missing paper '+n);
      assert.equal(await page.locator('#dnd14-page-3 .dnd14-rich').count(),6,
        'The note page must have six independent rich editors');
      const metrics=await page.evaluate(()=>{
        const paper=document.querySelector('.dnd14-paper');
        const scroll=document.querySelector('.dnd14-scroll');
        const zone=document.querySelector('#dnd14-page-1 .dnd14-zone');
        const p=paper.getBoundingClientRect(),s=scroll.getBoundingClientRect();
        return {paperWidth:p.width,paperHeight:p.height,viewportWidth:s.width,scrollWidth:scroll.scrollWidth,
          overflow:document.documentElement.scrollWidth-window.innerWidth,
          zoneWidth:zone.getBoundingClientRect().width};
      });
      assert.ok(metrics.paperWidth>=790&&metrics.paperWidth<=810,JSON.stringify(metrics));
      assert.ok(metrics.paperHeight>=1110&&metrics.paperHeight<=1140,JSON.stringify(metrics));
      assert.ok(metrics.zoneWidth>600,'Identity spans the A4 page rather than mobile column');
      assert.ok(metrics.overflow<8,'No top-level horizontal overflow: '+JSON.stringify(metrics));
      if(width<768)assert.ok(metrics.scrollWidth>metrics.viewportWidth,
        'Narrow screens must pan paper instead of restacking');
      assert.deepEqual(errors,[],'Browser rendering errors');
      console.log('PASS D&D 2014 paper',width,metrics.paperWidth+'x'+metrics.paperHeight);
      if(width!==390)continue;
      await page.getByLabel('Значение: ЛОВКОСТЬ').fill('18');
      await page.getByLabel('Владение: Акробатика').selectOption('proficient');
      assert.match(await page.getByRole('region',{name:'Спасброски и навыки'}).innerText(),/\+6/);
      await page.getByLabel('Имя персонажа').fill('Аврора Ночная');
      await page.getByLabel('Текущие ХП').fill('14');
      await page.getByLabel('Ячейки 1 круга: всего').fill('3');
      await page.getByLabel('Ячейки 1 круга: потрачено').fill('2');
      await page.locator('#dnd14-note1 .pf-rich-editable').fill('Первый самостоятельный блок');
      await page.locator('#dnd14-spellLevel1 .pf-rich-editable').fill('Волшебная стрела');
      await page.getByRole('button',{name:'Изменить портрет D&D'}).click();
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.portraitOpens===1);
      // An autosave may finish while Playwright scrolls to page 4. A disabled
      // manual button is therefore a success state, not a UI failure.
      const manual=page.getByRole('button',{name:'Сохранить',exact:true});
      if(await manual.isEnabled())await manual.click();
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.saves.some(x=>x.name==='Аврора Ночная'&&x.details.dnd5eSheet.content.blocks.note1.includes('Первый')));
      const saved=await page.evaluate(()=>window.__AYS_DND_2014_TEST__.saves.at(-1));
      assert.equal(saved.details.dnd5eSheet.abilities.dex.score,18);
      assert.equal(saved.details.dnd5eSheet.combat.hp.current,14);
      assert.equal(saved.details.dnd5eSheet.spellcasting.slots.normal['1'].maximum,3);
      assert.equal(saved.details.dnd5eSheet.spellcasting.slots.normal['1'].used,2);
      assert.equal(saved.details.dnd5eSheet.content.blocks.spellLevel1,'Волшебная стрела');
      assert.equal(saved.details.dnd5eSheet.content.blocks.note2,'Сохранённый второй блок',
        'Unedited note blocks must survive');
      assert.equal(saved.details.notes,'Общий дополнительный текст',
        'Shared character metadata must survive autosave');
      await page.getByRole('button',{name:'3. Заметки'}).click();
      await page.waitForTimeout(100);
      assert.ok(await page.locator('#dnd14-page-3').count());
      await page.getByRole('button',{name:'К персонажам'}).click();
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.closed===1);
    }finally{await page.close();}
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
