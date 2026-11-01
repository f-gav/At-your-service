import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port='4199';
const origin='http://127.0.0.1:'+port+'/At-your-service/tests/pdf-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',
  env:{...process.env,VITE_BASE_PATH:'/At-your-service/',VITE_SUPABASE_URL:'',
    VITE_SUPABASE_PUBLISHABLE_KEY:''}});
let browser;
async function ready(){
  for(let i=0;i<75;i++){
    try{if((await fetch(origin)).ok)return;}catch{/* Vite starting */}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('Sheet re-opening browser fixture was not served');
}
async function saved(page,system,assertion){
  await page.waitForFunction(([system,assertion])=>{
    const raw=sessionStorage.getItem('ays-sheet-roundtrip-fixture-'+system);
    if(!raw)return false;
    const saved=JSON.parse(raw);
    if(assertion==='moon')return saved.details?.projectMoonSheet?.fields?.occupation==='Медицинский отдел'
      &&saved.details?.projectMoonSheet?.inventoryColumns===4
      &&saved.details?.projectMoonSheet?.outfits?.[0]?.name==='Новая броня'
      &&saved.details?.projectMoonSheet?.augments?.[0]?.name==='Новый аугмент';
    if(assertion==='moon-hidden')return saved.details?.projectMoonSheet?.hiddenPages?.includes('equipment');
    if(assertion==='moon-shown')return !saved.details?.projectMoonSheet?.hiddenPages?.includes('equipment');
    if(assertion==='pf')return saved.name==='Новая героиня'
      &&saved.details?.pathfinderSheet?.pf2e_layout==='classic';
    return false;
  },[system,assertion],{timeout:15000});
}
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [390,1360]){
    const context=await browser.newContext({viewport:{width,height:820},acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      const moonUrl=origin+'?system=prmoon&save=test&reopen=1';
      await page.goto(moonUrl,{waitUntil:'networkidle'});
      await page.locator('.moon-name input').fill('Новая героиня');
      await page.locator('.moon-page-dossier .moon-field')
        .filter({hasText:'Занятие'}).first().locator('input').fill('Медицинский отдел');
      await page.getByRole('combobox',{name:'Количество колонок инвентаря'}).selectOption('4');
      await page.getByRole('textbox',{name:'Название брони 1'}).fill('Новая броня');
      await page.getByRole('textbox',{name:'Название аугмента 1'}).fill('Новый аугмент');
      await saved(page,'prmoon','moon');
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('.moon-name input').inputValue(),'Новая героиня');
      assert.equal(await page.getByRole('textbox',{name:'Название брони 1'}).inputValue(),'Новая броня');
      assert.equal(await page.getByRole('textbox',{name:'Название аугмента 1'}).inputValue(),'Новый аугмент');
      assert.equal(await page.locator('.moon-inventory-column').count(),4,
        'Four-column inventory must survive actual component remount');
      await page.locator('.moon-settings-area .pf-settings-button').click();
      await page.getByRole('button',{name:'Страницы листа…'}).click();
      await page.getByRole('button',{name:'Скрыть страницу «Экипировка»'}).click();
      await page.getByRole('button',{name:'Готово'}).click();
      await saved(page,'prmoon','moon-hidden');
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('.moon-page-equipment').count(),0,
        'Hidden page must stay hidden after remount');
      await page.locator('.moon-settings-area .pf-settings-button').click();
      await page.getByRole('button',{name:'Страницы листа…'}).click();
      await page.getByRole('button',{name:'Показать страницу «Экипировка»'}).click();
      await page.getByRole('button',{name:'Готово'}).click();
      await saved(page,'prmoon','moon-shown');
      assert.equal(await page.getByRole('textbox',{name:'Название брони 1'}).inputValue(),'Новая броня',
        'Showing the formerly hidden page must restore armor edits');
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.getByRole('textbox',{name:'Название аугмента 1'}).inputValue(),'Новый аугмент');
      console.log('PASS: Project Moon save/reopen, 4 inventory columns, armor, augments, hide/unhide at '+width);

      const pfUrl=origin+'?system=pf2e&variant=alternative&save=test&reopen=1';
      await page.goto(pfUrl,{waitUntil:'networkidle'});
      await page.getByRole('textbox',{name:'Имя персонажа',exact:true}).fill('Новая героиня');
      await page.getByRole('button',{name:'Классический PF2e'}).click();
      await saved(page,'pf2e','pf');
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('.pf-alt-page').count(),0,
        'Saved classic variant must override the original fixture query parameter');
      assert.equal(await page.locator('.pf-sheet-page').count(),4);
      const actual=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ays-sheet-roundtrip-fixture-pf2e')));
      assert.equal(actual.details.pathfinderSheet.name,'Новая героиня');
      console.log('PASS: Pathfinder alternative→classic layout and name survive actual remount at '+width);
      assert.deepEqual(errors,[],'Unexpected errors during sheet reopen at '+width);
    }finally{await context.close();}
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
