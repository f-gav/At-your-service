import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';

const address='http://127.0.0.1:4173/At-your-service/tests/pdf-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port','4173','--strictPort'],{stdio:'ignore',env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
const files=await mkdtemp(join(tmpdir(),'ays-pdf-test-'));
let browser;
try {
  let ready=false;
  for(let i=0;i<60;i++){
    try{const response=await fetch(address);if(response.ok){ready=true;break;}}catch{ /* vite starting */ }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Vite preview server did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const cases=[
    {system:'prmoon',notes:false,extras:false,expected:6},
    {system:'prmoon',notes:false,extras:false,inventory:true,expected:6},
    {system:'pf2e',notes:false,extras:false,expected:4},
    {system:'pf2e',notes:true,extras:false,expected:5},
    {system:'pf2e',notes:false,extras:false,variant:'alternative',expected:4},
    {system:'pf2e',notes:true,extras:false,variant:'alternative',expected:5},
    {system:'pf2e',notes:false,extras:false,variant:'alternative',long:true,expectedMin:5,expectedMax:10},
    {system:'prmoon',notes:false,extras:true,expected:8},
  ];
  for(const [index,test] of cases.entries()){
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
    page.setDefaultTimeout(180000);
    const logs=[];
    page.on('pageerror',error=>logs.push(String(error)));
    try{
      await page.goto(address+`?system=${test.system}&notes=${test.notes?'1':'0'}&extras=${test.extras?'1':'0'}&variant=${test.variant||'classic'}&long=${test.long?'1':'0'}&inventory=${test.inventory?'1':'0'}`,{waitUntil:'domcontentloaded'});
      const selector=test.system==='pf2e'?(test.variant==='alternative'?'.pf-alt-page':'.pf-sheet-page'):'.moon-paper';
      await page.waitForSelector(selector);
      const expectedDom=test.system==='pf2e'?(test.notes?5:4):5;
      assert.equal(await page.locator(selector).count(),expectedDom,'HTML sheet page count');
      if(test.inventory){
        const columns=page.locator('.moon-inventory-column');
        assert.equal(await columns.count(),4,'All four inventory columns must render in PDF');
        for(const [index,text] of ['ПЕРВАЯ КОЛОНКА','ВТОРАЯ КОЛОНКА','ТРЕТЬЯ КОЛОНКА','ЧЕТВЕРТАЯ КОЛОНКА'].entries()){
          assert.ok((await columns.nth(index).innerText()).includes(text),'Inventory item not visible: '+text);
        }
        const bounded=await columns.evaluateAll(items=>items.every((item,index)=>{
          if(index===0)return true;
          const previous=items[index-1].getBoundingClientRect();
          const current=item.getBoundingClientRect();
          return current.left>=previous.right-1&&current.width>0;
        }));
        assert.ok(bounded,'Inventory column boundaries may not overlap');
        const note=page.locator('.moon-note .pf-rich-editable').first();
        const size=await note.evaluate(el=>getComputedStyle(el).fontSize);
        assert.equal(size,'21px','Per-note text sizing should affect printed notes');
      }
      const dimensions=await page.locator(selector).evaluateAll(elements=>elements.map(el=>({
        page:el.id,height:el.getBoundingClientRect().height,scrollHeight:el.scrollHeight,width:el.getBoundingClientRect().width
      })));
      console.log('Source HTML pages:',JSON.stringify(dimensions));
      const promise=page.waitForEvent('download',{timeout:180000});
      await page.locator('#generate-test-pdf').click();
      const download=await promise;
      const path=join(files,`case-${index}.pdf`);
      await download.saveAs(path);
      const bytes=await readFile(path);
      assert.ok(bytes.subarray(0,8).toString().startsWith('%PDF-'),'Downloaded a real PDF');
      assert.ok(bytes.length>40000,'PDF should contain actual rendered pages');
      const count=(bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
      if(test.expectedMin!==undefined){
        assert.ok(count>=test.expectedMin&&count<=test.expectedMax,
          `Unexpected alternative HTML PDF page count: ${count} pages`);
      }else{
        assert.equal(count,test.expected,`Wrong PDF page count for ${JSON.stringify(test)}; ${count} pages`);
      }
      assert.equal(logs.length,0,`Browser errors: ${logs.join('; ')}`);
      console.log(`PASS: ${test.system} ${test.notes?'notes':''} ${test.extras?'extras':''} — ${count} PDF pages, ${bytes.length} bytes`);
    }catch(error){
      console.error('PDF browser case failed:',test);
      console.error('Page diagnostic:',await page.locator('body').getAttribute('data-pdf-error').catch(()=>null));
      throw error;
    }finally{await page.close();}
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
  await rm(files,{recursive:true,force:true});
}
