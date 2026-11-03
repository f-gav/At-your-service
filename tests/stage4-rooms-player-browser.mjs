import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const css=readFileSync(new URL('../src/features/rooms/RoomsHub.css',import.meta.url),'utf8');
const html=`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>
:root{--text:#243243;--border:#dce2de;--surface:#fff}
*{box-sizing:border-box}body{margin:0}
${css}</style><main class="ays-rooms ays-rooms-in-room"><section class="ays-room-open">
<nav class="ays-room-tabs"><button>Стол</button><button>Игроки и персонажи</button><button>Настройки</button></nav>
<div class="ays-room-table"><section class="ays-room-table-characters"><h3>Персонажи</h3>
<div class="ays-room-member-grid"><article class="ays-room-member"><div class="ays-room-member-title">
<span class="ays-room-member-name">ОченьДлинноеИмяПерсонажаКотороеНеДолжноРаздвигатьКолонки</span>
</div><div class="ays-room-stat">HP 50 / 100</div></article>
<article class="ays-room-member"><div class="ays-room-member-title"><span class="ays-room-member-name">Second character</span></div>
<div class="ays-room-stat">ST 30 / 50</div></article></div></section>
<aside class="ays-room-events"><h3>История событий</h3></aside></div></section></main>`;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const width of [390,560,820,1200]){
  const page=await browser.newPage({viewport:{width,height:800}});
  try{
   await page.setContent(html);
   const measure=await page.evaluate(()=>{
    const cols=selector=>getComputedStyle(document.querySelector(selector)).gridTemplateColumns.trim().split(/\s+/).length;
    return {pageWidth:document.documentElement.scrollWidth,tableColumns:cols('.ays-room-table'),
      characterColumns:cols('.ays-room-table .ays-room-member-grid')};
   });
   assert.ok(measure.pageWidth<=width+2,`horizontal overflow at ${width}: ${JSON.stringify(measure)}`);
   assert.equal(measure.tableColumns,width>=760?2:1,`table hierarchy at ${width}`);
   if(width<760)assert.equal(measure.characterColumns,width>=490?2:1,`member grid at ${width}`);
   console.log('PASS Rooms table viewport',width,measure);
  }finally{await page.close();}
 }
}finally{await browser?.close();}
