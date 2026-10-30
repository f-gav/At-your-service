import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const port='4192';
const origin='http://127.0.0.1:'+port;
const home=origin+'/At-your-service/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',
  env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
let browser;
const samples={
  home:['.site-header','.hero','.hero p','.library-heading','.library-heading h2',
    '.system-filter','.character-card','.character-card .character-data strong'],
  library:['.site-header','.spell-library-page .spell-intro-heading h1',
    '.spell-library-page .spell-content-heading h2','.spell-system-tab',
    '.spell-category','.spell-result-identity strong'],
};
const metrics=async(page,selectors)=>page.evaluate(selectors=>{
  const result={};
  for(const selector of selectors){
    const element=document.querySelector(selector);
    if(!element)throw Error('Missing visual comparator: '+selector);
    const c=getComputedStyle(element),r=element.getBoundingClientRect();
    result[selector]={
      fontFamily:c.fontFamily,fontSize:c.fontSize,fontWeight:c.fontWeight,
      fontStyle:c.fontStyle,lineHeight:c.lineHeight,letterSpacing:c.letterSpacing,
      textTransform:c.textTransform,whiteSpace:c.whiteSpace,
      display:c.display,padding:c.padding,margin:c.margin,borderWidth:c.borderWidth,
      borderRadius:c.borderRadius,
      geometry:[r.x,r.y,r.width,r.height].map(x=>Math.round(x*10)/10),
    };
  }
  result.viewport={scrollWidth:document.documentElement.scrollWidth,
    innerWidth:window.innerWidth};
  return result;
},selectors);
function compare(light,dark,width,screen){
  for(const selector of Object.keys(light)){
    if(selector==='viewport')continue;
    for(const key of Object.keys(light[selector])){
      if(key==='geometry'){
        light[selector][key].forEach((v,i)=>assert.ok(
          Math.abs(v-dark[selector][key][i])<1.6,
          width+' '+screen+' '+selector+' geometry['+i+'] drifted '+v+
          ' -> '+dark[selector][key][i]));
      }else assert.equal(dark[selector][key],light[selector][key],
        width+' '+screen+' '+selector+' typography/layout '+key+' changed');
    }
  }
  assert.ok(Math.abs(light.viewport.scrollWidth-dark.viewport.scrollWidth)<2,
    'Switching theme must not change horizontal overflow at '+width);
}
try{
  for(let i=0;i<60;i++){
    try{if((await fetch(home)).ok)break;}catch{/* server starting */}
    if(i===59)throw Error('Theme browser server did not start');
    await new Promise(r=>setTimeout(r,250));
  }
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const width of [1360,390,320]){
    const context=await browser.newContext({viewport:{width,height:820}});
    await context.addInitScript(()=>localStorage.setItem('ays-site-theme','light'));
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(home,{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('html').getAttribute('data-ays-theme'),'light');
      // Signed-out visitors have no cards, so add a *visual-only* representative
      // card and test its CSS without creating anything in Supabase.
      await page.evaluate(()=>{
        const grid=document.querySelector('.character-grid')??document.querySelector('.page-home');
        const card=document.createElement('div');
        card.className='character-card visual-test-card';
        card.innerHTML='<div class="character-open"><div class="character-data">'+
          '<strong>Граций — Pathfinder</strong><span>Тестовый персонаж</span></div></div>';
        grid.appendChild(card);
      });
      const original=await metrics(page,samples.home);
      const toggle=page.locator('.theme-toggle:visible').first();
      await toggle.click();
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.locator('html').getAttribute('data-ays-theme'),'dark');
      compare(original,await metrics(page,samples.home),width,'home');

      await page.goto(home+'library/',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const darkLibrary=await metrics(page,samples.library);
      await page.locator('.theme-toggle:visible').first().click();
      await page.evaluate(()=>document.fonts.ready);
      compare(await metrics(page,samples.library),darkLibrary,width,'library');

      assert.deepEqual(errors,[],'Theme transitions must not throw JS errors');
      console.log('PASS: theme typography/geometry stable on home and library at '+width);
    }finally{await context.close();}
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

// CSS-level future regression gate: dark theme may adjust paint but must not
// declare typography/geometry/visibility overrides. Keep custom-sheet
// typography in its own (theme-independent) stylesheets.
const themeCss=readFileSync(new URL('../src/site-theme.css',import.meta.url),'utf8');
for(const [,selector,block] of themeCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(!selector.includes(':root[data-ays-theme="dark"]'))continue;
  for(const declaration of block.split(';')){
    const i=declaration.indexOf(':');
    if(i<0)continue;
    const name=declaration.slice(0,i).trim();
    assert.doesNotMatch(name,/^(?:font(?:-.+)?|line-height|letter-spacing|text-transform|white-space|display|visibility|width|height|min-width|min-height|max-width|max-height|margin(?:-.+)?|padding(?:-.+)?|transform|border-radius|border-width|border|gap|grid-.+|flex-.+)$/,
      'Dark theme must be paint-only: '+name);
  }
}
console.log('PASS: dark mode CSS contains no typography/geometry overrides');
