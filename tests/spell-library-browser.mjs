import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const port='4183';
const origin='http://127.0.0.1:'+port;
const base=origin+'/At-your-service/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',port,'--strictPort'],{stdio:'ignore',env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
let browser;
try{
  let ready=false;
  for(let i=0;i<60;i++){
    try{if((await fetch(base)).ok){ready=true;break;}}catch{/* waiting */}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Vite test server did not start');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1360,height:860}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base,{waitUntil:'networkidle'});
  assert.ok(await page.getByRole('heading',{name:/Мои персонажи/}).isVisible(),'Character home unchanged');
  const headerMetrics=()=>page.evaluate(()=>{
    const header=document.querySelector('.site-header').getBoundingClientRect();
    const nav=document.querySelector('.site-nav').getBoundingClientRect();
    return {x:header.x,width:header.width,top:header.top,navX:nav.x,
      viewportWidth:document.documentElement.clientWidth};
  });
  const homeHeader=await headerMetrics();
  await page.locator('.site-nav').getByRole('button',{name:'Библиотека'}).click();
  assert.equal(new URL(page.url()).hash,'#library');
  const libraryHeader=await headerMetrics();
  for(const key of ['x','width','navX','viewportWidth']){
    assert.ok(Math.abs(homeHeader[key]-libraryHeader[key])<1,
      'Switching tabs must not move the topbar horizontally: '+key+
      ', home='+homeHeader[key]+', library='+libraryHeader[key]);
  }
  assert.equal(libraryHeader.top,0,'Header stays at the top of the viewport');
  await page.getByRole('heading',{name:'Библиотека заклинаний'}).waitFor();
  await page.getByText('24 записей',{exact:true}).waitFor();
  assert.equal(await page.locator('.spell-result').count(),24);
  // TЗ: responsive wide catalog uses exactly 4 / 3 / 2 / 1 tiles per row.
  for(const [width,columns] of [[1700,4],[1280,3],[820,2],[390,1]]){
    await page.setViewportSize({width,height:900});
    const stats=await page.evaluate(()=>{
      const tiles=Array.from(document.querySelectorAll('.spell-result')).slice(0,4);
      const top=tiles[0]?.getBoundingClientRect().top;
      return {columns:tiles.filter(t=>Math.abs(t.getBoundingClientRect().top-top)<2).length,
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.equal(stats.columns,columns,`Incorrect tile grid at ${width}px: ${stats.columns}`);
    assert.ok(stats.overflow<=1,`Horizontal page overflow at ${width}px: ${stats.overflow}`);
  }
  await page.setViewportSize({width:1360,height:860});
  assert.ok(await page.locator('.spell-library-page').evaluate(el=>el.getBoundingClientRect().width)>1150,
    'Library expands beyond the old 1180px narrow page on desktop');
  assert.equal(await page.locator('.spell-result-stats').count(),24,
    'Compact tiles show three metadata fields');
  // Legibility regression: open the accordion before measuring field heights.
  await page.locator('.spell-filter-toggle').click();
  const librarySizing=await page.evaluate(()=>{
    const size=selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const height=selector=>document.querySelector(selector).getBoundingClientRect().height;
    return {
      title:size('.spell-intro-heading h1'),
      tab:size('.spell-system-tab span'),
      category:size('.spell-kind-chip'),
      search:size('.spell-search input'),
      searchHeight:height('.spell-search'),
      filter:size('.spell-filter-grid select'),
      filterHeight:height('.spell-filter-grid select'),
      nav:size('.site-nav button'),
    };
  });
  assert.ok(librarySizing.title>=36,'Library title is legible');
  assert.ok(librarySizing.tab>=17,'System tabs should have large titles');
  assert.ok(librarySizing.category>=15,'Category buttons should have readable text');
  assert.ok(librarySizing.search>=15&&librarySizing.searchHeight>=50,'Search is large and touch friendly');
  assert.ok(librarySizing.filter>=14&&librarySizing.filterHeight>=44,'Filters are not tiny');
  assert.ok(librarySizing.nav>=15,'Top navigation typography matches enlarged library');
  await page.locator('.spell-filter-toggle').click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
    'Desktop library must have no horizontal overflow');
  assert.equal(await page.locator('.spell-total').textContent(),'24 записей');
  await page.getByRole('searchbox',{name:'Поиск заклинаний'}).fill('Электрическая дуга');
  assert.equal(await page.locator('.spell-result').count(),1);
  const tile=page.locator('.spell-result').first();
  assert.ok(await tile.locator('.spell-source-label').isVisible(),'Each tile retains a source-book badge');
  assert.equal(await tile.locator('.spell-mini-stat').count(),3,'Each tile exposes casting/range/defense');
  const listBefore=await page.locator('.spell-result').count();
  const scrollBefore=await page.evaluate(()=>scrollY);
  await page.locator('.spell-result').first().click();
  const dialog=page.getByRole('dialog',{name:'Электрическая дуга [Electric Arc]'});
  await dialog.waitFor();
  await page.getByRole('heading',{name:'Электрическая дуга [Electric Arc]'}).waitFor();
  assert.equal(await page.locator('.spell-result').count(),listBefore,'Results remain mounted behind modal');
  assert.equal(await page.evaluate(()=>scrollY),scrollBefore,'Opening modal does not reset list scroll');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden','Backdrop locks background scrolling');
  assert.equal(await dialog.getByText('Источник: Pathfinder Player Core').count(),1,
    'Actual source book is displayed inside the spell popup');
  assert.equal(await dialog.getByText('Текст на проверке').count(),0,'Do not show draft label');
  assert.equal(await dialog.getByRole('link',{name:'Источник'}).count(),0,'No external source button');
  assert.ok(await page.getByText('2d4 урона электричеством',{exact:false}).isVisible());
  assert.ok(await page.locator('.spell-descriptors span').count()>0);
  const order=await page.evaluate(()=>{
    const top=selector=>document.querySelector(selector).getBoundingClientRect().top;
    return ['.spell-viewer-top h2','.spell-descriptors','.spell-parameters','.spell-description','.spell-availability'].map(top);
  });
  assert.ok(order.every((v,i)=>i===0||v>=order[i-1]),'LSS information sequence must be preserved');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'','Background scrolling unlocked');
  assert.equal(await page.locator('.spell-result').count(),1,'Filtered result persists after Escape');
  await page.getByRole('searchbox',{name:'Поиск заклинаний'}).fill('Ancient Dust');
  await page.locator('.spell-result').first().click();
  await page.getByText('Правила до Remaster',{exact:true}).waitFor();
  await page.locator('.spell-modal-overlay').click({position:{x:4,y:4}});
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.locator('.spell-result').first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Закрыть описание'}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('searchbox',{name:'Поиск заклинаний'}).fill('');
  // Quick ranks and categories use real catalog filtering, independent of expanded filters.
  await page.getByRole('button',{name:'1',exact:true}).click();
  assert.equal(await page.locator('.spell-result').count(),0,'Rank 1 has no spells in first wave');
  await page.getByRole('button',{name:'0',exact:true}).click();
  assert.equal(await page.locator('.spell-result').count(),24,'Rank 0 shows all imported cantrips');
  await page.getByRole('button',{name:'Чары',exact:true}).click();
  assert.ok(await page.getByRole('heading',{name:'Чары'}).isVisible());
  await page.getByRole('button',{name:/Фильтры/}).click();
  assert.ok(await page.locator('.spell-filter-panel').isVisible(),'Extended filters can open on desktop');
  assert.equal(await page.getByRole('button',{name:/Фильтры/}).getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:/Фильтры/}).click();
  assert.ok(!(await page.locator('.spell-filter-panel').isVisible()),'Extended filters can close on desktop');
  await page.getByRole('searchbox',{name:'Поиск заклинаний'}).fill('неизвестное');
  await page.locator('.spell-reset-main').click();
  assert.equal(await page.getByRole('searchbox',{name:'Поиск заклинаний'}).inputValue(),'');
  await page.getByRole('button',{name:/D&D 5e/}).click();
  await page.getByText('0 записей',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Каталог пока пуст'}).waitFor();
  assert.equal(await page.locator('.spell-filter-grid select').first().inputValue(),'dnd-2024');
  assert.equal(await page.getByRole('button',{name:'Фокусные'}).count(),0);
  await page.getByRole('button',{name:/Pathfinder 2e/}).click();
  assert.equal(await page.getByRole('button',{name:'Фокусные'}).count(),1);
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Библиотека заклинаний'}).waitFor();
  await page.locator('.site-nav').getByRole('button',{name:'Персонажи'}).click();
  assert.ok(await page.getByRole('heading',{name:/Мои персонажи/}).isVisible());
  const backHeader=await headerMetrics();
  assert.ok(Math.abs(homeHeader.navX-backHeader.navX)<1,'Tab position returns without a slide');
  // WreckTrack behavior: navigation bar is sticky, and returning from a scrolled
  // section resets the scroll before users see the next section.
  await page.locator('.site-nav').getByRole('button',{name:'Библиотека'}).click();
  await page.evaluate(()=>{document.body.style.minHeight='1800px';window.scrollTo({top:500,behavior:'instant'});});
  await page.waitForFunction(()=>window.scrollY>400);
  const atScroll=await headerMetrics();
  assert.ok(Math.abs(atScroll.top)<1,'Header must remain fixed while scrolling');
  await page.locator('.site-nav').getByRole('button',{name:'Персонажи'}).click();
  await page.waitForFunction(()=>window.scrollY===0);
  const afterScroll=await headerMetrics();
  assert.ok(Math.abs(afterScroll.navX-homeHeader.navX)<1,'Header position stays constant after scroll navigation');
  await page.close();
  // Browser-only synthetic fixture validates how the platform will behave
  // after import. Production JSON manifests remain strictly empty.
  const preview=await browser.newPage({viewport:{width:1360,height:860}});
  const fixture={
    schemaVersion:1,system:'pf2e',
    sources:[{id:'test-source',name:'Тестовый справочник'}],
    spells:Array.from({length:55},(_,i)=>({
      id:'fixture-'+i,system:'pf2e',slug:'fixture-'+i,kind:'spell',rank:1,
      traditions:['arcane'],classes:[],traits:['mental'],rarity:'common',sourceId:'test-source',
    })),
    versions:Array.from({length:55},(_,i)=>({id:'fixture-version-'+i,spellId:'fixture-'+i,edition:'pf2e-remaster',cast:{actions:2}})),
    translations:Array.from({length:55},(_,i)=>({
      spellId:'fixture-'+i,versionId:'fixture-version-'+i,locale:'ru',
      name:'Проверочное заклинание '+String(i+1).padStart(3,'0'),
      summary:'Проверка отображения карточки',description:'Текст синтетического образца.',
    })),
  };
  await preview.route('**/spell-library/pf2e.json',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(fixture)
  }));
  await preview.goto(base+'#library',{waitUntil:'networkidle'});
  await preview.getByText('55 записей',{exact:true}).waitFor();
  assert.equal(await preview.locator('.spell-result').count(),50,'Catalog results are paginated');
  await preview.getByRole('button',{name:'Показать ещё'}).click();
  assert.equal(await preview.locator('.spell-result').count(),55);
  await preview.locator('.spell-result').first().click();
  assert.equal(await preview.locator('.spell-result').count(),55,'All 55 rows remain behind dialog');
  assert.ok(await preview.getByRole('dialog').getByText('Текст синтетического образца.').isVisible());
  assert.ok(await preview.locator('.spell-result').first().locator('span').textContent()!=='Example Spell');
  await preview.getByRole('button',{name:'Закрыть описание'}).click();
  assert.equal(await preview.locator('.spell-result').count(),55);
  await preview.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(base+'#library',{waitUntil:'networkidle'});
  await mobile.getByRole('heading',{name:'Библиотека заклинаний'}).waitFor();
  const phoneSizing=await mobile.evaluate(()=>{
    const tab=document.querySelector('.spell-system-tab span');
    const category=document.querySelector('.spell-kind-chip');
    return {tab:parseFloat(getComputedStyle(tab).fontSize),
      category:parseFloat(getComputedStyle(category).fontSize),
      overflow:document.documentElement.scrollWidth-window.innerWidth};
  });
  assert.ok(phoneSizing.tab>=15&&phoneSizing.category>=14,'Mobile text stays readable');
  assert.ok(phoneSizing.overflow<=1,'Larger mobile controls must not overflow horizontally');
  assert.ok(await mobile.locator('.site-tabs-mobile').getByRole('button',{name:'Библиотека'}).isVisible());
  const mobileHeader=await mobile.locator('.site-header').boundingBox();
  const mobileNavigation=await mobile.locator('.site-tabs-mobile').boundingBox();
  await mobile.getByRole('button',{name:/Фильтры/}).click();
  assert.ok(await mobile.locator('.spell-filter-panel').isVisible());
  await mobile.getByRole('searchbox',{name:'Поиск заклинаний'}).fill('Электрическая дуга');
  await mobile.locator('.spell-result').first().click();
  const phoneDialog=mobile.getByRole('dialog');
  await phoneDialog.waitFor();
  const modalBounds=await mobile.locator('.spell-modal').boundingBox();
  assert.ok(modalBounds.x>=0&&modalBounds.x+modalBounds.width<=390+1,
    'Popup must fit the mobile viewport');
  assert.equal(await mobile.locator('.spell-result').count(),1);
  await mobile.getByRole('button',{name:'Закрыть описание'}).click();
  await phoneDialog.waitFor({state:'hidden'});
  await mobile.locator('.site-tabs-mobile').getByRole('button',{name:'Персонажи'}).click();
  assert.ok(await mobile.getByRole('heading',{name:/Мои персонажи/}).isVisible());
  const mobileAfterHeader=await mobile.locator('.site-header').boundingBox();
  const mobileAfterNavigation=await mobile.locator('.site-tabs-mobile').boundingBox();
  assert.ok(Math.abs(mobileAfterHeader.x-mobileHeader.x)<1,'Mobile header must not slide');
  assert.ok(Math.abs(mobileAfterNavigation.x-mobileNavigation.x)<1,'Mobile tabs must stay aligned');
  const mobileOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(mobileOverflow<=1,'Tabs must not introduce horizontal overflow: '+mobileOverflow);
  assert.deepEqual(errors,[],'No browser JavaScript exceptions');
  console.log('PASS: desktop/mobile primary tabs, deep-link, independent empty catalogs, filters and responsive UI');
  await mobile.close();
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}
