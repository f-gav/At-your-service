import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const port='4195';
const origin='http://127.0.0.1:'+port+'/At-your-service/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',env:{
    ...process.env,VITE_BASE_PATH:'/At-your-service/',
    VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:'',
  }});
let browser;
async function renderReady(url){
  for(let i=0;i<65;i++){
    try{if((await fetch(url)).ok)return;}catch{/* Vite starting */}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Stage 2 UX browser server not ready');
}
function rectWithin(rect,width,height,what){
  assert.ok(rect.x>=-2&&rect.x+rect.width<=width+2,
    what+' exceeds horizontal viewport: '+JSON.stringify(rect));
  assert.ok(rect.y>=-2&&rect.y+rect.height<=height+2,
    what+' exceeds vertical viewport: '+JSON.stringify(rect));
}
try{
  await renderReady(origin);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const [width,height] of [[320,568],[390,667],[1360,800]]){
    const context=await browser.newContext({viewport:{width,height}});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      // Real app: OAuth-setup failure must appear on whichever tab is active,
      // not just home. No Supabase credentials or mutations are used.
      for(const route of ['library/','rooms/']){
        await page.goto(origin+route,{waitUntil:'networkidle'});
        if(width<=650){
          await page.locator('.mobile-menu-button').click();
          await page.locator('.mobile-account-row').getByRole('button',{name:/Войти через Google/}).click();
        }else{
          await page.getByRole('button',{name:/Войти через Google/}).first().click();
        }
        const alert=page.locator('.site-feedback .global-error[role="alert"]');
        await alert.waitFor();
        assert.match(await alert.innerText(),/Supabase/i,
          'Setup failure must be visible on '+route+' at '+width);
        const errorFit=await alert.evaluate(element=>{
          const r=element.getBoundingClientRect();
          return {x:r.x,width:r.width,scrollWidth:element.scrollWidth,clientWidth:element.clientWidth};
        });
        assert.ok(errorFit.x>=-1&&errorFit.x+errorFit.width<=width+1,
          'Error banner must stay within viewport');
        await alert.getByRole('button',{name:'Закрыть ошибку'}).click();
        assert.equal(await page.locator('.site-feedback .global-error').count(),0);
      }

      // Verify actual catalog titles are fully shown with long unbroken text.
      await page.goto(origin+'library/',{waitUntil:'networkidle'});
      const card=page.locator('.spell-result-identity strong').first();
      await card.waitFor();
      const word='ОченьДлинноеНазваниеЗаклинанияБезПробелов123456789012345678901234567890';
      await card.evaluate((el,text)=>{el.textContent=text;},word);
      const title=await card.evaluate(el=>{
        const r=el.getBoundingClientRect(),styles=getComputedStyle(el);
        return {height:r.height,width:r.width,scrollHeight:el.scrollHeight,
          clientHeight:el.clientHeight,overflow:styles.overflow,
          lineClamp:styles.webkitLineClamp,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
      });
      assert.ok(title.scrollHeight<=title.clientHeight+1&&title.scrollWidth<=title.clientWidth+1,
        'Long spell title clipped at '+width+': '+JSON.stringify(title));
      assert.equal(title.lineClamp,'none','Spell title must not use 2-line clamping');

      // The actual modal hook: lock scrolling, keep focus in the dialog,
      // restore focus to trigger and fit short/mobile screens.
      await page.goto(origin+'tests/stage2-dialog-harness.html',{waitUntil:'networkidle'});
      await page.locator('#open-dialog').click();
      const modal=page.locator('.create-modal[role="dialog"]');
      await modal.waitFor();
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
      const geometry=await page.evaluate(()=>{
        const modal=document.querySelector('.create-modal');
        const overlay=document.querySelector('.modal-backdrop');
        const header=document.querySelector('.site-header');
        const r=modal.getBoundingClientRect();
        const title=modal.querySelector('h2');
        return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},
          overlayZ:Number(getComputedStyle(overlay).zIndex),
          headerZ:Number(getComputedStyle(header).zIndex),
          scrollable:modal.scrollHeight>modal.clientHeight,
          titleFits:title.scrollWidth<=title.clientWidth+1};
      });
      rectWithin(geometry.rect,width,height,'Character modal');
      assert.ok(geometry.overlayZ>geometry.headerZ,'Modal must cover sticky header');
      assert.ok(geometry.titleFits,'Long modal heading must wrap');
      assert.ok(geometry.scrollable,'Long modal must scroll inside a short viewport');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'first-field');
      await page.locator('#last-button').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'first-field',
        'Tab from last control must wrap to first');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'last-button',
        'Shift+Tab must remain in modal');
      await page.keyboard.press('Escape');
      await modal.waitFor({state:'detached'});
      await page.waitForFunction(()=>document.activeElement?.id==='open-dialog',
        {timeout:3000});
      assert.equal(await page.evaluate(()=>document.activeElement?.id),'open-dialog',
        'Closing restores previous focus');
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'',
        'Closing restores page scroll');

      // Same small-viewport geometry for room dialogs (CSS only: no server
      // connection and no production Auth credentials used).
      const roomRect=await page.evaluate(()=>{
        const overlay=document.createElement('div');
        overlay.className='ays-room-dialog-backdrop';
        const dialog=document.createElement('section');
        dialog.className='ays-room-dialog';
        dialog.innerHTML='<h2>ОченьДлинноеНазваниеКомнатыБезПробелов123456789012345678901234567890</h2>'+
          '<form><label>Название комнаты<input value="Тест" /></label><label>Игровая система'+
          '<select><option>Pathfinder 2e</option></select></label></form>';
        overlay.append(dialog);document.body.append(overlay);
        const r=dialog.getBoundingClientRect();
        const result={rect:{x:r.x,y:r.y,width:r.width,height:r.height},
          overlayZ:Number(getComputedStyle(overlay).zIndex),
          headerZ:Number(getComputedStyle(document.querySelector('.site-header')).zIndex),
          titleFits:dialog.querySelector('h2').scrollWidth<=dialog.querySelector('h2').clientWidth+1};
        overlay.remove();return result;
      });
      rectWithin(roomRect.rect,width,height,'Room modal');
      assert.ok(roomRect.overlayZ>roomRect.headerZ,'Room modal must cover sticky header');
      assert.ok(roomRect.titleFits,'Room title must wrap on mobile');
      assert.deepEqual(errors,[],'Unexpected JS errors at viewport '+width);
      console.log('PASS: app error visibility, long titles, mobile modal fit and focus trap at '+width);
    }finally{await context.close();}
  }
  const rooms=readFileSync(new URL('../src/features/rooms/RoomsHub.tsx',import.meta.url),'utf8');
  assert.equal((rooms.match(/className="ays-room-dialog-error"/g)||[]).length,1,
    'Room failures must not render duplicated error alerts');
  console.log('PASS: one room dialog error, safe accessible operation feedback');
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
