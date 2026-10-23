import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const port='4188';
const origin='http://127.0.0.1:'+port;
const base=origin+'/At-your-service/tests/pdf-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
let browser;
const failures=[];
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{if((await fetch(base)).ok){ready=true;break;}}catch{ /* waiting for Vite */ }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Release smoke Vite server did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1440,390,320]){
    const context=await browser.newContext({viewport:{width,height:800},acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    try{
      await page.goto(base+'?system=prmoon&save=test',{waitUntil:'networkidle'});
      const moon=page.locator('.moon-editor');
      await moon.waitFor();
      assert.equal(await moon.locator('.moon-paper').count(),5,'All Moon pages mount at '+width);
      const bounds=await moon.boundingBox();
      assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=width+1,
        'Moon editor must fit within viewport at '+width+': '+JSON.stringify(bounds));

      const name=moon.locator('.moon-name input');
      assert.ok(await name.isVisible(),'Name remains accessible at '+width);
      await name.fill('Тест Moon '+width);
      const occupation=moon.locator('.moon-page-dossier .moon-field').filter({hasText:'Занятие'}).first().locator('input');
      await occupation.fill('Отдел анализа');
      const columns=moon.getByRole('combobox',{name:'Количество колонок инвентаря'});
      await columns.selectOption('4');
      assert.equal(await moon.locator('.moon-inventory-column').count(),4,
        'Inventory must show four editable columns');
      await columns.selectOption('1');
      assert.equal(await moon.locator('.moon-inventory-column').count(),1,
        'Switching columns must not leave hidden editors in layout');
      await columns.selectOption('4');

      const equipment=moon.locator('.moon-page-equipment');
      assert.equal(await equipment.locator('.moon-outfit-card').count(),2);
      assert.equal(await equipment.locator('.moon-augment-card').count(),2);
      await equipment.getByRole('textbox',{name:'Название брони 1'}).fill('Броня '+width);
      await equipment.getByRole('checkbox',{name:'Надета броня 1'}).check();
      await equipment.getByRole('textbox',{name:'Название аугмента 1'}).fill('Аугмент '+width);
      await equipment.getByRole('textbox',{name:'Положительные EP аугмента 1'}).fill('2');
      await equipment.getByRole('button',{name:'Добавить броню'}).click();
      await equipment.getByRole('button',{name:'Добавить аугмент'}).click();
      assert.equal(await equipment.locator('.moon-outfit-card').count(),3);
      assert.equal(await equipment.locator('.moon-augment-card').count(),3);
      assert.ok(await equipment.getByRole('button',{name:'Предыдущая броня'}).isEnabled(),
        'Carousel should allow navigating back to old armor');
      const offscreen=await equipment.evaluate(element=>{
        const carousels=element.querySelectorAll('.moon-equipment-carousel');
        return Array.from(carousels).some(carousel=>carousel.getBoundingClientRect().right>window.innerWidth+1);
      });
      assert.equal(offscreen,false,'Equipment carousels must remain within viewport at '+width);

      await page.waitForFunction(()=>window.__pfSaveEvents?.some(entry=>
        entry.name.startsWith('Тест Moon')&&entry.details.projectMoonSheet?.fields?.occupation==='Отдел анализа'&&
        entry.details.projectMoonSheet?.inventoryColumns===4&&
        entry.details.projectMoonSheet?.outfits?.length===3&&
        entry.details.projectMoonSheet?.augments?.length===3&&
        entry.details.projectMoonSheet?.outfits?.[0]?.name==='Броня '+window.innerWidth&&
        entry.details.projectMoonSheet?.augments?.[0]?.name==='Аугмент '+window.innerWidth),{timeout:15000});
      await moon.locator('.auto-save-saved').waitFor();
      const last=await page.evaluate(()=>window.__pfSaveEvents.at(-1));
      assert.equal(last.name,'Тест Moon '+width);
      assert.equal(last.details.projectMoonSheet.fields.occupation,'Отдел анализа');
      assert.equal(last.details.projectMoonSheet.inventoryColumns,4);
      assert.equal(last.details.projectMoonSheet.outfits[0].name,'Броня '+width);
      assert.equal(last.details.projectMoonSheet.equippedOutfitId,'outfit-1');
      assert.equal(last.details.projectMoonSheet.augments[0].name,'Аугмент '+width);
      assert.equal(last.details.projectMoonSheet.augments[0].positiveEp,'2');
      assert.equal(last.details.projectMoonSheet.outfits.length,3);
      assert.equal(last.details.projectMoonSheet.augments.length,3);
      assert.deepEqual(errors,[],'Moon browser must have no JS errors at '+width);
      console.log('PASS: Project Moon outfit/augment carousels, autosave and inventory at '+width);
    }finally{await context.close();}
  }

  const failContext=await browser.newContext({viewport:{width:390,height:800}});
  const fail=await failContext.newPage();
  const errors=[];
  fail.on('pageerror',error=>errors.push(error.message));
  try{
    await fail.goto(base+'?system=prmoon&save=test&fail=1',{waitUntil:'networkidle'});
    await fail.locator('.moon-name input').fill('Локальный черновик Moon');
    await fail.locator('.auto-save-error').waitFor();
    const exists=await fail.evaluate(()=>
      Object.keys(localStorage).some(key=>key.includes('ays-unsaved-draft-v1:')));
    assert.ok(exists,'Failed Project Moon save must preserve its local draft');
    await fail.reload({waitUntil:'networkidle'});
    assert.equal(await fail.locator('.moon-name input').inputValue(),'Локальный черновик Moon',
      'Reload must recover Project Moon draft when the cloud baseline is unchanged');
    assert.deepEqual(errors,[],'Moon recovery must not throw browser errors');
    console.log('PASS: Project Moon failed-cloud-save recovery');
  }finally{await failContext.close();}

  // Source-level release gate: all supported exports, tests and app shell must remain wired.
  const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const app=source('../src/App.tsx');
  const json=source('../src/lib/character-json.ts');
  const pdf=source('../src/lib/sheet-pdf.ts');
  assert.match(app,/parseCharacterJson\(await file\.text\(\)\)/,'JSON import must remain wired');
  assert.match(app,/downloadCharacter\(freshest\)/,'JSON export must load the latest saved snapshot');
  assert.match(app,/exportCharacterPdf\(character\)/,'PDF export must remain wired');
  assert.match(json,/format: 'at-your-service-character'/,'JSON v1 compatibility must remain');
  assert.match(pdf,/exportRenderedSheetPdf/,'Sheet PDF export must remain wired');
  console.log('PASS: release export entrypoints remain connected');
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
