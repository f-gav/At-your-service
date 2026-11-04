import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=4226,origin='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-classic2014-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],
  {stdio:'ignore',env:{...process.env,VITE_BASE_PATH:'/At-your-service/',
    VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''}});
let browser;
try{
  let ready=false;
  for(let i=0;i<90;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,200));}
  assert.ok(ready,'Conflict test harness not ready');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const edition of ['2014','2024']){
    const page=await browser.newPage({viewport:{width:390,height:860}});
    try{
      await page.goto(origin+'?edition='+edition+'&conflict=1',{waitUntil:'networkidle'});
      const input=page.getByLabel(edition==='2014'?'Имя персонажа':'Имя героя');
      await input.fill('Два устройства · '+edition);
      await page.getByText('Ошибка сохранения').waitFor({timeout:15000});
      assert.equal(await input.inputValue(),'Два устройства · '+edition,
        'Conflict must preserve unsaved form data');
      await page.getByRole('button',{name:'К персонажам'}).click();
      await page.waitForTimeout(120);
      assert.equal(await page.evaluate(()=>window.__AYS_DND_2014_TEST__.closed),0,
        'Back navigation must not silently discard failed cloud save');
      await page.evaluate(()=>{window.__AYS_DND_2014_TEST__.rejectSaves=false;});
      await page.getByRole('button',{name:'Повторить сохранение'}).click();
      await page.getByText('Сохранено в облаке').waitFor();
      const stored=await page.evaluate(()=>window.__AYS_DND_2014_TEST__.saves.at(-1));
      assert.equal(stored.name,'Два устройства · '+edition);
      assert.equal(stored.details.dnd5eSheet.layoutEdition,edition);
      await page.getByRole('button',{name:'К персонажам'}).click();
      await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.closed===1);
      console.log('PASS D&D '+edition+' failed CAS, retained draft, retry, guarded navigation');
    }finally{await page.close();}
  }
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
