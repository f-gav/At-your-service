import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=4216,root='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-classic2014-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',
  '--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',env:{
  ...process.env,VITE_BASE_PATH:'/At-your-service/',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',
}});
let browser;
try{
  let ready=false;
  for(let i=0;i<100;i++){
    try{if((await fetch(root)).ok){ready=true;break;}}catch{/* startup */}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,'2024 browser test harness did not become available');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [320,390,768,1360]){
    const page=await browser.newPage({viewport:{width,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',async dialog=>{if(dialog.type()==='confirm')await dialog.accept();else await dialog.dismiss();});
    try{
      await page.goto(root+'?edition=2024',{waitUntil:'networkidle'});
      await page.locator('[data-dnd-classic-version="2024"]').waitFor();
      assert.equal(await page.locator('.dnd24-paper').count(),4);
      for(let n=1;n<=4;n++)assert.equal(await page.locator('#dnd24-page-'+n).count(),1);
      assert.equal(await page.locator('#dnd24-page-1 [data-ability]').count(),6,
        '2024 abilities must have independent grouped-skill zones');
      assert.equal(await page.locator('#dnd24-page-3 .dnd14-rich').count(),6,
        '2024 notes must have six independent RichField editors');
      assert.equal(await page.locator('#dnd24-page-4 .dnd24-slot').count(),9,
        '2024 page 4 must show nine slot circles');
      const metrics=await page.evaluate(()=>{
        const paper=document.querySelector('.dnd24-paper');
        const scroller=document.querySelector('.dnd14-scroll');
        const rect=paper.getBoundingClientRect(),viewport=scroller.getBoundingClientRect();
        const points=[...document.querySelectorAll('.dnd24-paper .dnd14-zone')].map(node=>{
          const box=node.getBoundingClientRect(),parent=node.closest('.dnd24-paper').getBoundingClientRect();
          return box.left>=parent.left-1&&box.right<=parent.right+1&&
            box.top>=parent.top-1&&box.bottom<=parent.bottom+1;
        });
        return {width:rect.width,height:rect.height,pan:scroller.scrollWidth-viewport.width,
          overflow:document.documentElement.scrollWidth-window.innerWidth,zonesInside:points.every(Boolean)};
      });
      assert.ok(metrics.width>=790&&metrics.width<=810,JSON.stringify(metrics));
      assert.ok(metrics.height>=1110&&metrics.height<=1140,JSON.stringify(metrics));
      assert.ok(metrics.zonesInside,'All 2024 zones must fit inside the paper');
      assert.ok(metrics.overflow<8,'No viewport-wide overflow: '+JSON.stringify(metrics));
      if(width<768)assert.ok(metrics.pan>50,'Mobile must pan fixed A4 paper horizontally');
      assert.deepEqual(errors,[],'Client exceptions while mounting 2024 page');
      console.log('PASS 2024 paper',width,metrics.width+'×'+metrics.height);
      if(width!==390)continue;

      await page.getByLabel('2024 значение ЛОВКОСТЬ').fill('18');
      await page.getByLabel('Владение: Скрытность').selectOption('proficient');
      const dex=page.locator('#dnd24-page-1 [data-ability="dex"]');
      assert.match(await dex.innerText(),/\+6/,'Stealth should show DEX+proficiency');
      await page.getByLabel('Истощение').fill('2');
      await page.waitForFunction(()=>document.querySelector('#dnd24-page-1 [aria-label="Инициатива · скорость · состояния"]')?.textContent?.includes('20 фт'));
      assert.match(await dex.innerText(),/\+2/,'2024 exhaustion reduces a d20 test by 4');
      await page.getByLabel('Новое состояние').fill('Отравлен');
      await page.getByLabel('Новое состояние').press('Enter');
      await page.getByRole('button',{name:'Убрать состояние Отравлен'}).waitFor();
      await page.getByLabel('2024 ячейки 1 всего').fill('3');
      await page.getByLabel('2024 ячейки 1 потрачено').fill('1');
      await page.getByLabel('Имя героя').fill('Аврора 2024');
      await page.locator('#dnd24-note1 .pf-rich-editable').fill('Секретный дневник');
      await page.locator('#dnd24-spellLevel1 .pf-rich-editable').fill('Волшебная стрела');
      await page.getByRole('button',{name:'Изменить портрет D&D 2024'}).click();
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.portraitOpens===1);
      await page.getByRole('button',{name:'Лист 2014'}).click();
      await page.locator('[data-dnd-classic-version="2014"]').waitFor();
      await page.locator('#dnd14-page-3 .dnd14-rich').first().waitFor();
      assert.equal(await page.getByLabel('Имя персонажа').inputValue(),'Аврора 2024');
      assert.match(await page.locator('#dnd14-note1 .pf-rich-editable').innerText(),/Секретный дневник/);
      assert.equal(await page.getByLabel('Ячейки 1 круга: всего').inputValue(),'3');
      assert.equal(await page.getByLabel('Редакция правил D&D').inputValue(),'2024',
        'Changing paper must NOT change rules');
      await page.getByRole('button',{name:'Лист 2024'}).click();
      await page.locator('[data-dnd-classic-version="2024"]').waitFor();
      assert.equal(await page.getByLabel('2024 значение ЛОВКОСТЬ').inputValue(),'18');
      assert.match(await page.locator('#dnd24-note1 .pf-rich-editable').innerText(),/Секретный дневник/);
      assert.equal(await page.getByLabel('2024 ячейки 1 потрачено').inputValue(),'1');
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.saves.some(x=>
        x.name==='Аврора 2024'&&x.details.dnd5eSheet.layoutEdition==='2024'&&
        x.details.dnd5eSheet.content.blocks.note1.includes('Секретный')));
      const stored=await page.evaluate(()=>window.__AYS_DND_2014_TEST__.saves.at(-1));
      assert.equal(stored.details.dnd5eSheet.rulesEdition,'2024');
      assert.equal(stored.details.dnd5eSheet.layoutEdition,'2024');
      assert.equal(stored.details.dnd5eSheet.abilities.dex.score,18);
      assert.deepEqual(stored.details.dnd5eSheet.combat.conditions,['Отравлен']);
      assert.equal(stored.details.dnd5eSheet.spellcasting.slots.normal['1'].maximum,3);
      assert.equal(stored.details.dnd5eSheet.spellcasting.slots.normal['1'].used,1);
      assert.match(stored.details.dnd5eSheet.content.blocks.spellLevel1,/Волшебная стрела/);
      assert.equal(stored.details.dnd5eSheet.content.blocks.note2,'Сохранённый второй блок');
      assert.equal(stored.details.notes,'Общий дополнительный текст');
      await page.getByRole('button',{name:'3. Заметки'}).click();
      await page.locator('#dnd24-page-3').waitFor();
      await page.getByRole('button',{name:'К персонажам'}).click();
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.closed===1);
    }finally{await page.close();}
  }
  // Compare opposite paper switching direction without changing rulesEdition.
  const page=await browser.newPage({viewport:{width:390,height:900}});
  try{
    await page.goto(root+'?edition=2014',{waitUntil:'networkidle'});
    await page.getByLabel('Значение: СИЛА').fill('17');
    await page.getByRole('button',{name:'Лист 2024'}).click();
    await page.locator('[data-dnd-classic-version="2024"]').waitFor();
    assert.equal(await page.getByLabel('2024 значение СИЛА').inputValue(),'17');
    assert.equal(await page.getByLabel('Редакция правил D&D').inputValue(),'2014');
    await page.getByRole('button',{name:'Лист 2014'}).click();
    assert.equal(await page.getByLabel('Значение: СИЛА').inputValue(),'17');
  }finally{await page.close();}
  console.log('PASS D&D Classic 2014/2024 switch, page geometry, autosave and preservation');
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
