import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port='4198',origin='http://127.0.0.1:'+port+'/At-your-service/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',env:{
    ...process.env,VITE_BASE_PATH:'/At-your-service/',
    VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',
  }});
let browser;
const url=origin+'tests/stage2-save-harness.html';
async function ready(){
  for(let i=0;i<70;i++){
    try{if((await fetch(url)).ok)return;}catch{/* startup */}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('Autosave browser harness did not start');
}
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'networkidle'});
  const getGate=()=>page.evaluate(()=>window.__AYS_SAVE_TEST__);
  const setMode=mode=>page.evaluate(m=>{window.__AYS_SAVE_TEST__.mode=m;},mode);
  const waitCalls=n=>page.waitForFunction(n=>window.__AYS_SAVE_TEST__.calls.length>=n,n);
  await setMode('hold');
  await page.locator('#notes').fill('Первая редакция');
  await waitCalls(1);
  assert.equal(await page.locator('#status').innerText(),'saving');
  await page.locator('#notes').fill('Вторая редакция');
  // A new write must not race the old one (even after debounce).
  await page.waitForTimeout(100);
  assert.equal((await getGate()).calls.length,1,'Second write must wait for first ack');
  await page.evaluate(()=>{window.__AYS_SAVE_TEST__.pending.shift().resolve(true);});
  await waitCalls(2);
  assert.equal((await getGate()).calls.length,2,'Latest pending state must be saved after first');
  assert.ok((await getGate()).calls[1].includes('Вторая редакция'));
  await page.evaluate(()=>{window.__AYS_SAVE_TEST__.pending.shift().resolve(true);});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='saved');
  const key='ays-unsaved-draft-v1:synthetic-user:synthetic-character';
  assert.equal(await page.evaluate(key=>window.localStorage.getItem(key),key),null,
    'Cloud ack must clear precisely the saved local draft');
  await setMode('reject');
  await page.locator('#notes').fill('Третья редакция');
  await page.locator('#save-error').waitFor();
  assert.equal(await page.locator('#status').innerText(),'error');
  assert.match(await page.locator('#save-error').innerText(),/Тестовая ошибка сети/);
  assert.ok((await page.evaluate(key=>window.localStorage.getItem(key),key)).includes('Третья редакция'),
    'Network error must leave emergency snapshot on device');
  await page.locator('#back').click();
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#closed').innerText(),'open',
    'Back must not discard an unsaved edit after network failure');
  await setMode('success');
  await page.getByRole('button',{name:'Повторить сохранение'}).click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='saved');
  assert.equal(await page.evaluate(key=>window.localStorage.getItem(key),key),null);
  await setMode('conflict');
  await page.locator('#notes').fill('Конфликтующее изменение');
  await page.waitForFunction(()=>document.querySelector('#save-error')?.textContent?.includes('другой вкладке'));
  assert.equal(await page.locator('#status').innerText(),'error');
  assert.ok((await page.evaluate(key=>window.localStorage.getItem(key),key)).includes('Конфликтующее изменение'));
  assert.equal(await page.locator('#closed').innerText(),'open');

  // Stale cloud baseline cannot auto-apply unsaved edits; user can still
  // download their own device-only work without any production connection.
  await page.evaluate(()=>{
    const key='ays-unsaved-draft-v1:synthetic-user:synthetic-character';
    window.localStorage.setItem(key,JSON.stringify({
      base:'{"notes":"old cloud"}',snapshot:'{"notes":"private conflict export"}',
      updatedAt:Date.now(),
    }));
  });
  await page.reload({waitUntil:'networkidle'});
  const notice=page.locator('.ays-device-draft-warning');
  await notice.waitFor();
  assert.match(await notice.innerText(),/другой версии/);
  const pending=page.waitForEvent('download');
  await notice.getByRole('button',{name:'Скачать черновик'}).click();
  const download=await pending;
  assert.equal(download.suggestedFilename(),'At-your-service-device-drafts.json');
  assert.deepEqual(errors,[],'Browser autosave scenarios must not raise JS errors');
  console.log('PASS: sequential saves, network failures, blocked navigation, retry, stale CAS and manual device-draft export');
  await context.close();
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
