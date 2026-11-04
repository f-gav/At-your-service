import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';

const port=4225,origin='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-classic2014-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],
  {stdio:'ignore',env:{...process.env,VITE_BASE_PATH:'/At-your-service/',
    VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''}});
const temp=await mkdtemp(join(tmpdir(),'ays-dnd-pdf-'));
await mkdir('test-artifacts',{recursive:true});
let browser;
try {
  let ready=false;
  for(let n=0;n<90;n++){
    try{if((await fetch(origin)).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,220));
  }
  assert.ok(ready,'D&D PDF test harness unavailable');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  for(const edition of ['2014','2024']){
    const page=await browser.newPage({viewport:{width:390,height:870},acceptDownloads:true});
    const errors=[];
    page.setDefaultTimeout(180000);
    page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(origin+'?edition='+edition+'&long=1',{waitUntil:'networkidle'});
      await page.locator('.dnd14-paper').first().waitFor();
      assert.equal(await page.locator('.dnd14-paper').count(),4);
      const originalText=await page.locator('#dnd'+(edition==='2024'?'24':'14')+'-note1 .pf-rich-editable').innerText();
      assert.ok(originalText.length>9000,'Long source field must be real data');
      const downloadEvent=page.waitForEvent('download',{timeout:180000});
      await page.getByRole('button',{name:'Экспорт PDF'}).click();
      const download=await downloadEvent;
      const filename=download.suggestedFilename();
      assert.ok(filename.startsWith('DnD-'+edition+'-'),filename);
      const file=join(temp,'DND_'+edition+'.pdf');
      await download.saveAs(file);
      const data=await readFile(file);
      assert.ok(data.subarray(0,5).toString()==='%PDF-','Download is a real PDF');
      assert.ok(data.length>25000,'PDF must contain 4 rendered papers');
      const count=(data.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length;
      assert.ok(count>=5&&count<=100,'Expect 4 A4 paper pages plus text supplements; got '+count);
      // PDF pages are image-backed. Raster inspection is more informative
      // than pdftotext for this exporter; persist images for human review.
      const info=execFileSync('pdfinfo',[file],{encoding:'utf8'});
      assert.match(info,/Page size:\s+595(?:\.\d+)? x 842(?:\.\d+)? pts/);
      for(const index of [...new Set([1,4,5,count])]){
        const output=join('test-artifacts','dnd-'+edition+'-page-'+index);
        execFileSync('pdftoppm',['-f',String(index),'-l',String(index),
          '-scale-to','1200','-png','-singlefile',file,output]);
        const raster=PNG.sync.read(await readFile(output+'.png'));
        assert.ok(raster.width>700&&raster.height>950,'Invalid A4 raster size');
        let colored=0;
        for(let y=0;y<raster.height;y+=3)for(let x=0;x<raster.width;x+=3){
          const i=(y*raster.width+x)*4;
          if(raster.data[i]<242||raster.data[i+1]<242||raster.data[i+2]<242)colored++;
        }
        assert.ok(colored>350,'Nearly blank PDF page '+edition+'/'+index);
        console.log('PDF RASTER '+edition+' page '+index+' nonwhite samples '+colored);
      }
      assert.ok(!await page.locator('.dnd-pdf-stage').count(),'Offscreen export stage must be cleaned');
      assert.deepEqual(errors,[],'No browser exceptions');
      console.log('PASS D&D '+edition+' downloadable A4 PDF, '+count+' pages, '+data.length+' bytes');
    }catch(e){
      console.error('Edition '+edition+' export error:',await page.locator('[data-pdf-error]').allTextContents());
      throw e;
    }finally{await page.close();}
  }
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
  await rm(temp,{recursive:true,force:true});
}
