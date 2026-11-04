import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=4219,origin='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-classic2014-harness.html';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],
  {stdio:'ignore',env:{...process.env,VITE_BASE_PATH:'/At-your-service/',
    VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''}});
let browser;
try{
  let ready=false;
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,180));}
  assert.ok(ready,'advanced D&D harness unavailable');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const edition of ['2014','2024']){
    const page=await browser.newPage({viewport:{width:390,height:850}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin+'?edition='+edition,{waitUntil:'networkidle'});
      const panel=page.getByRole('region',{name:'Дополнительные механики D&D'});
      await panel.waitFor();
      assert.equal(await page.locator('.dnd14-paper').count(),4);
      await page.getByRole('tab',{name:'Гримуар'}).click();
      await page.getByRole('button',{name:'+ Заклинание'}).click();
      assert.equal(await panel.locator('tbody tr').count(),1);
      const spellRow=panel.locator('tbody tr').first();
      await spellRow.locator('input[type="text"]').first().fill('Исцеление');
      await spellRow.locator('input[type="checkbox"]').nth(1).check();
      await page.getByLabel('pact максимум 1').fill('2');
      await page.getByRole('tab',{name:'Ресурсы и состояния'}).click();
      await page.getByRole('button',{name:'+ Ресурс'}).click();
      await page.getByRole('button',{name:'+ Эффект'}).click();
      await page.getByRole('tab',{name:'Бонусы'}).click();
      await page.getByRole('button',{name:'+ Бонус'}).click();
      await page.getByRole('tab',{name:'Классы и способности'}).click();
      await page.getByRole('button',{name:'+ Класс'}).click();
      await page.getByRole('button',{name:'+ Способность'}).click();
      await page.getByRole('tab',{name:'Формулы'}).click();
      await page.getByLabel('Формула D&D').fill('floor([LVL]/2)+[PROF]');
      await page.getByRole('button',{name:'Вычислить без кубиков'}).click();
      assert.match(await panel.innerText(),/2/);
      // Both editions use the exact same D&D domain payload.
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.saves.some(
        s=>s.details.dnd5eSheet.spellcasting.spells.length===1&&
          s.details.dnd5eSheet.classes.length===1&&
          s.details.dnd5eSheet.features.length===1&&
          s.details.dnd5eSheet.bonuses.length===1));
      const saved=await page.evaluate(()=>window.__AYS_DND_2014_TEST__.saves.at(-1));
      assert.equal(saved.details.dnd5eSheet.layoutEdition,edition);
      assert.equal(saved.details.dnd5eSheet.spellcasting.spells[0].name,'Исцеление');
      assert.equal(saved.details.dnd5eSheet.spellcasting.spells[0].prepared,true);
      assert.equal(saved.details.dnd5eSheet.spellcasting.slots.pact['1'].maximum,2);
      assert.equal(saved.details.dnd5eSheet.resources.length,1);
      assert.equal(saved.details.dnd5eSheet.effects.length,1);
      assert.equal(saved.details.dnd5eSheet.classes.length,1);
      assert.equal(saved.details.dnd5eSheet.features.length,1);
      assert.equal(saved.details.notes,'Общий дополнительный текст');
      assert.deepEqual(errors,[]);
      console.log('PASS D&D extended browser',edition);
    }finally{await page.close();}
  }
}finally{if(browser)await browser.close();vite.kill('SIGTERM');}
