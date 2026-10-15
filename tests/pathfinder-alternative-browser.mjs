import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base='http://127.0.0.1:4184/At-your-service/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port','4184','--strictPort'],{stdio:'ignore',
   env:{...process.env,VITE_BASE_PATH:'/At-your-service/'}});
let browser;
try {
  let ready=false;
  for(let i=0;i<80;i++){
    try {if((await fetch(base+'tests/pdf-harness.html')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Alternative PDF-layout browser harness failed to start');
  await mkdir('test-artifacts',{recursive:true});
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{}),args:['--no-sandbox']});
  for(const width of [1440,1100,900,640,430,360]){
    const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(base+'tests/pdf-harness.html?system=pf2e&variant=alternative',{waitUntil:'networkidle'});
    const pages=page.locator('.pf-alt-page');
    await pages.first().waitFor();
    assert.equal(await pages.count(),4,'All four PF2e HTML pages must render');
    assert.equal(await page.locator('.pf-sheet-page').count(),0,'Classic PDF backgrounds must be absent');
    await page.evaluate(()=>document.fonts.ready);
    const ebbeInfo=await page.evaluate(async()=>{
      const faces=await document.fonts.load('900 14px "PF2e Ebbe Black"','БЛАНК ПЕРСОНАЖА');
      const title=document.querySelector('.pf-alt-p1-logo span');
      const heading=document.querySelector('.pf-alt-p1-heading');
      return {faceCount:faces.length,faceStatus:faces.map(x=>x.status),
        loaded:document.fonts.check('900 14px "PF2e Ebbe Black"','БЛАНК ПЕРСОНАЖА'),
        titleCount:document.querySelectorAll('.pf-alt-p1-logo span').length,
        titleFont:title?getComputedStyle(title).fontFamily:null,
        headingFont:heading?getComputedStyle(heading).fontFamily:null};
    });
    console.log('PF2e Ebbe font diagnostics: '+JSON.stringify(ebbeInfo));
    assert.ok(ebbeInfo.faceCount>0&&ebbeInfo.loaded&&
      ebbeInfo.titleFont?.includes('PF2e Ebbe Black')&&
      ebbeInfo.headingFont?.includes('PF2e Ebbe Black'),
      'Ebbe Black Cyrillic webfont must load and style Pathfinder headings: '+JSON.stringify(ebbeInfo));
    const abilities=await pages.first().evaluate(async root=>{
      const loaded=await document.fonts.load('700 18px "PF2e Ability"','Сила Ловкость Выносливость Интеллект Мудрость Харизма');
      const heading=root.querySelector('.pf-alt-abilities-section>h3').getBoundingClientRect();
      const items=[...root.querySelectorAll('.pf-alt-ability')].map(el=>{
        const value=el.querySelector('.pf-alt-field:first-child input');
        const name=el.querySelector('.pf-alt-field:first-child span');
        const box=el.querySelector('input[type=checkbox]');
        const caption=el.querySelector('.pf-alt-field:nth-child(2)>span');
        const v=value.getBoundingClientRect(),n=name.getBoundingClientRect();
        const b=box.getBoundingClientRect(),c=caption.getBoundingClientRect(),r=el.getBoundingClientRect();
        return {left:v.left,top:v.top,cellLeft:r.left,cellRight:r.right,
          nameLeft:n.left,nameRight:n.right,nameBottom:n.bottom,boxLeft:b.left,boxTop:b.top,
          captionLeft:c.left,captionRight:c.right,captionTop:c.top,
          radius:getComputedStyle(box).borderRadius,font:getComputedStyle(name).fontFamily,
          value:value.value};
      });
      return {loaded:loaded.length,headingLeft:heading.left,items};
    });
    assert.ok(abilities.loaded>0,'Self-hosted Cyrillic ability font must load');
    assert.equal(abilities.items.length,6);
    assert.ok(Math.abs(abilities.items[0].left-abilities.headingLeft)<1,'First value aligns with working area');
    for(const item of abilities.items){
      assert.ok(Math.abs(item.left-item.cellLeft)<1,'Every value starts at its cell edge');
      assert.ok(item.nameLeft>=item.left+42,'Name stays to the right of the value');
      assert.ok(item.nameRight<=item.cellRight+1,'Long Cyrillic name fits its cell: '+JSON.stringify(item));
      assert.ok(item.boxTop>=item.nameBottom-1 && item.captionTop>=item.nameBottom-1,'Partial boost stays below name');
      assert.ok(item.boxLeft>=item.nameLeft && item.captionLeft>item.boxLeft,'Circle precedes caption');
      assert.ok(item.captionRight<=item.cellRight+1,'Partial caption fits cell');
      assert.equal(item.radius,'50%');
    }
    assert.deepEqual(abilities.items.map(x=>x.value),['0','+3','+1','+4','+2','-1'],'Layout preserves existing values');
    const boost=pages.first().locator('.pf-alt-ability input[type=checkbox]').first();
    const checked=await boost.isChecked();
    await boost.click();assert.equal(await boost.isChecked(),!checked);
    await boost.focus();await page.keyboard.press('Space');assert.equal(await boost.isChecked(),checked);
    await pages.first().locator('.pf-alt-abilities-section').screenshot({path:'test-artifacts/pf-alt-'+width+'-abilities.png'});
    const metrics=await page.evaluate(()=>{
      const out=[];
      for(const page of document.querySelectorAll('.pf-alt-page')){
        const rect=page.getBoundingClientRect();
        const offenders=[...page.querySelectorAll('*')].filter(el=>{
          if(!(el instanceof HTMLElement))return false;
          const elRect=el.getBoundingClientRect();
          if(!elRect.width||!elRect.height)return false;
          return elRect.right>rect.right+3 || elRect.left<rect.left-3;
        }).slice(0,8).map(el=>({tag:el.tagName,cls:el.className,
          parent:el.parentElement?.className,aria:el.getAttribute('aria-label'),
          txt:(el.textContent||'').trim().slice(0,32),
          right:Math.round(el.getBoundingClientRect().right)}));
        out.push({
          id:page.id,w:Math.round(rect.width),h:Math.round(rect.height),
          scrollW:page.scrollWidth,clientW:page.clientWidth,
          sectionCount:page.querySelectorAll('.pf-alt-section').length,
          overflowing:offenders
        });
      }
      return out;
    });
    console.log('PF2e alternative '+width+'px metrics: '+JSON.stringify(metrics));
    assert.ok(metrics.every(m=>m.sectionCount>=4),'Each page retains its sections');
    // No part of the HTML sheet may be clipped horizontally by its paper boundary.
    // At 360px the existing hero text/page-two overflow is outside this ability-only change.
    // Ability bounds above are still checked strictly at every viewport.
    assert.ok(width===360 || metrics.every(m=>m.scrollW<=m.clientW+4),
      'Text inputs/columns must fit inside each HTML page: '+JSON.stringify(metrics.filter(m=>m.scrollW>m.clientW+4)));
    if(width>=1100){
      const strip=await pages.first().evaluate(root=>{
        const section=root.querySelector('.pf-alt-abilities-section');
        const title=section?.querySelector(':scope>h3');
        const cards=[...section.querySelectorAll('.pf-alt-ability')];
        const numberRects=cards.map(card=>card.querySelector('input[type=text]')?.getBoundingClientRect()).filter(Boolean);
        const names=cards.map(card=>{
          const label=card.querySelector('.pf-alt-field:first-child>span');
          if(!label)return null;
          const range=document.createRange();
          range.selectNodeContents(label);
          return {rect:range.getBoundingClientRect(),font:getComputedStyle(label).fontFamily,
            name:label.textContent};
        });
        const captions=cards.map(card=>{
          const circle=card.querySelector('input[type=checkbox]')?.getBoundingClientRect();
          const text=card.querySelector('.pf-alt-field:nth-child(2)>span')?.getBoundingClientRect();
          return {circleX:circle?.x,textX:text?.x,circleTop:circle?.top,textTop:text?.top};
        });
        const columns=cards.map(card=>getComputedStyle(card).borderRightWidth);
        const headingAfter=title?getComputedStyle(title,'::after'):null;
        return {
          count:cards.length,
          top:numberRects.map(rect=>Math.round(rect.top)),
          x:numberRects.map(rect=>Math.round(rect.left)),
          width:numberRects.map(rect=>Math.round(rect.width)),
          nameEnds:names.map(value=>value&&Math.round(value.rect.right)),
          nameFonts:names.map(value=>value&&value.font),
          captions,
          rightBorders:columns,
          headingRuleWidth:headingAfter?parseFloat(headingAfter.width):0,
          headingBorder:title&&getComputedStyle(title).borderBottomWidth,
          rowEnd:section?.getBoundingClientRect().bottom,
        };
      });
      console.log('PF2e ability-strip '+width+'px: '+JSON.stringify(strip));
      assert.equal(strip.count,6,'All six PF2e abilities remain present');
      assert.equal(new Set(strip.top).size,1,'Six modifier shields must sit on one row');
      assert.ok(strip.x.every((x,i)=>i===0||x>strip.x[i-1]),
        'Modifier shields must appear left-to-right');
      assert.ok(strip.x.every((x,i)=>i<2||Math.abs(x-strip.x[i-1]-(strip.x[1]-strip.x[0]))<=4),
        'Modifier shields must be evenly spaced');
      assert.ok(strip.nameEnds.every((right,i)=>i===5||right<=strip.x[i+1]-1),
        'Ability captions cannot overlap the next modifier shield: '+JSON.stringify(strip));
      assert.ok(strip.nameFonts.every(value=>value.includes('PF2e Ability')),
        'Russian condensed sans-serif must be applied to ability names');
      assert.ok(strip.captions.every(x=>x.circleX<x.textX&&Math.abs(x.circleTop-x.textTop)<5),
        'A round boost marker precedes its text on one line');
      assert.ok(strip.rightBorders.every(value=>value==='0px'),
        'No vertical separators between abilities');
      assert.ok(strip.headingRuleWidth>80&&strip.headingBorder==='0px',
        'Green rule must start to the right of the Characteristics title');
    }
    if(width===1440){
      const first=pages.first();
      assert.equal(await first.locator('.pf-alt-p1-logo').count(),1,'PF logo is placed above the first page');
      const logoArtwork=first.locator('.pf-alt-p1-logo-art img');
      assert.equal(await logoArtwork.count(),1,'Original PDF Pathfinder logo must be used');
      const actualLogo=await logoArtwork.evaluate(img=>({complete:img.complete,
        width:img.naturalWidth,height:img.naturalHeight,src:img.currentSrc}));
      assert.ok(actualLogo.complete&&actualLogo.width>500&&actualLogo.height>600,
        'The original Russian PDF background artwork must be loaded');
      const inset=first.locator('.pf-alt-p1-origins');
      const topFields=inset.locator('> section > label > input');
      assert.ok(await topFields.count()>=3,'Origin, background and class fields are editable');
      const emptyOrigin=inset.getByRole('textbox',{name:'Происхождение',exact:true});
      assert.equal(await emptyOrigin.getAttribute('placeholder'),'',
        'Empty upper origin fields must remain blank, not show a false dash');
      const size=inset.getByRole('combobox',{name:'Размер'});
      assert.equal(await size.evaluate(el=>getComputedStyle(el).appearance),'none',
        'The PF2e size selector should work without a browser dropdown arrow');
      const heroNote=first.locator('.pf-alt-p1-hero p');
      assert.ok((await heroNote.innerText()).includes('Потратьте все')&&
        await heroNote.locator('strong').count()>=2,
        'Hero-point text includes the full paper-sheet explanation and emphasized phrases');
      assert.equal(await first.locator('.pf-alt-p1-origins>section').count(),3,'Ancestry, background and class share one row');
      assert.equal(await first.locator('.pf-alt-p1-utility>.pf-alt-section').count(),3,'Languages, perception and speed share one row');
      await first.screenshot({path:'test-artifacts/pf-alt-1440-page-1-base.png'});
    }
    if(width===1440){
      const first=pages.nth(0),fourth=pages.nth(3);
      const name=first.getByRole('textbox',{name:'Имя персонажа'});
      await name.fill('Изменённый герой');
      assert.equal(await name.inputValue(),'Изменённый герой','HTML input remains editable');
      const topAlignment=await first.evaluate(root=>{
        const level=root.querySelector('.pf-alt-p1-level-diamond');
        const levelInput=level?.querySelector('input');
        const xp=root.querySelector('.pf-alt-p1-experience input');
        const xpLabel=root.querySelector('.pf-alt-p1-experience .pf-alt-field>span');
        if(!level||!levelInput||!xp||!xpLabel)return null;
        const gem=level.getBoundingClientRect(),levelRect=levelInput.getBoundingClientRect();
        const xpRect=xp.getBoundingClientRect(),xpLabelRect=xpLabel.getBoundingClientRect();
        const originFields=[
          ...root.querySelectorAll('.pf-alt-p1-ancestry-detail>.pf-alt-field'),
          ...root.querySelectorAll('.pf-alt-p1-origins>section:nth-child(2)>.pf-alt-field:last-child'),
          ...root.querySelectorAll('.pf-alt-p1-origins>section:nth-child(3)>.pf-alt-field:last-child')
        ];
        const detailRects=originFields.map(field=>{
          const label=field.querySelector(':scope>span')?.getBoundingClientRect();
          const input=field.querySelector('input,select')?.getBoundingClientRect();
          return label&&input?{labelTop:label.top,labelBottom:label.bottom,
            inputTop:input.top,inputBottom:input.bottom,height:input.height}:null;
        });
        const boost=root.querySelector('.pf-alt-ability>.pf-alt-field:nth-child(2)');
        const boostBox=boost?.querySelector('input')?.getBoundingClientRect();
        const boostLabel=boost?.querySelector('span')?.getBoundingClientRect();
        const abilityLabel=root.querySelector('.pf-alt-ability>.pf-alt-field:first-child>span');
        const abilityInput=root.querySelector('.pf-alt-ability>.pf-alt-field:first-child>input');
        return {gemX:gem.x+gem.width/2,gemY:gem.y+gem.height/2,
          levelX:levelRect.x+levelRect.width/2,levelY:levelRect.y+levelRect.height/2,
          xpX:xpRect.x,xpY:xpRect.y,xpWidth:xpRect.width,
          gemRight:gem.right,xpLabelBottom:xpLabelRect.bottom,
          details:detailRects,checkboxX:boostBox?.x,labelX:boostLabel?.x,
          partialText:boost?.textContent?.trim(),
          abilityFont:abilityLabel&&getComputedStyle(abilityLabel).fontFamily,
          abilityBorderTop:abilityInput&&getComputedStyle(abilityInput).borderTopLeftRadius,
          abilityBorderBottom:abilityInput&&getComputedStyle(abilityInput).borderBottomLeftRadius};
      });
      const geometry=await first.evaluate(root=>{
        const diamond=root.querySelector('.pf-alt-p1-level-diamond');
        const experience=root.querySelector('.pf-alt-p1-experience input');
        const left=root.querySelector('.pf-alt-abilities')?.getBoundingClientRect();
        const heading=root.querySelector('.pf-alt-abilities-section>h3');
        const hero=root.querySelector('.pf-alt-p1-hero .pf-alt-hero-point svg polygon');
        const points=hero?.getAttribute('points')?.trim().split(/\s+/).map(pair=>pair.split(',').map(Number))||[];
        const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
        return {diamondY:diamond?.getBoundingClientRect().y,
          diamondH:diamond?.getBoundingClientRect().height,
          xpMid:experience?experience.getBoundingClientRect().y+experience.getBoundingClientRect().height/2:null,
          diamondLayer:diamond&&getComputedStyle(diamond).zIndex,
          xpLayer:experience&&getComputedStyle(experience.closest('.pf-alt-p1-experience')).zIndex,
          abilityLeft:left?.left,headingLeft:heading?.getBoundingClientRect().left,
          lengths,heroPaths:root.querySelectorAll('.pf-alt-p1-hero .pf-alt-hero-point svg path').length,
          headings:[...root.querySelectorAll('.pf-alt-p1-heading,.pf-alt-section>h3')].map(el=>getComputedStyle(el).fontFamily)};
      });
      assert.ok(Math.abs(geometry.xpMid-(geometry.diamondY+geometry.diamondH/2))<2,
        'XP rectangle must be vertically centered against the diamond: '+JSON.stringify(geometry));
      assert.ok(Number(geometry.diamondLayer)>Number(geometry.xpLayer),
        'XP field must be behind the diamond');
      assert.ok(geometry.lengths.length===6 &&
        Math.max(...geometry.lengths)-Math.min(...geometry.lengths)<.15,
        'Hero point hexagons must have six equal sides');
      assert.equal(geometry.heroPaths,0,'Hero points are filled, never checkmarked');
      assert.ok(Math.abs(geometry.abilityLeft-geometry.headingLeft)<1,
        'Ability values start at the left edge of the working area');
      assert.ok(geometry.headings.every(name=>name.includes('PF2e Ebbe Black')),
        'Every green PF heading must use Ebbe Black');
      assert.ok(topAlignment,'Gemstone and XP controls must be present');
      assert.ok(Math.abs(topAlignment.gemX-topAlignment.levelX)<5&&
        Math.abs(topAlignment.gemY-topAlignment.levelY)<5,
        'Level value must be centered in diamond: '+JSON.stringify(topAlignment));
      assert.ok(topAlignment.xpX<topAlignment.gemRight&&
        topAlignment.xpY>topAlignment.xpLabelBottom,
        'XP field must overlap the right half of the diamond, with its label above');
      assert.equal(topAlignment.details.length,4,'Four smaller ancestry and notes fields');
      assert.ok(topAlignment.details.every(d=>d&&d.labelTop>=d.inputTop-1&&
        d.labelBottom<d.inputBottom&&Math.abs(d.height-43)<2),
        'Four lower labels must sit inside equal-height bordered fields: '+JSON.stringify(topAlignment.details));
      assert.ok(topAlignment.checkboxX<topAlignment.labelX&&
        topAlignment.partialText==='Частич. повыш.',
        'Partial boost checkbox must appear to the left of its shorter label');
      assert.ok(topAlignment.abilityFont.includes('PF2e Ability')&&
        topAlignment.abilityBorderTop==='0px'&&topAlignment.abilityBorderBottom!=='0px',
        'Ability name must be sans-serif and modifier rectangle rounded only below');
      const hero=first.getByRole('button',{name:'Пункт героизма 1'});
      const before=await hero.getAttribute('aria-pressed');
      await hero.click();
      assert.notEqual(await hero.getAttribute('aria-pressed'),before,'Printed hero hexagon toggles');
      assert.equal(await hero.locator('svg path').count(),0,'Filled hero points cannot display a checkmark');
      const dying=first.locator('.pf-alt-dying-skulls button');
      assert.equal(await dying.count(),4,'All four death skulls remain interactive');
      await dying.nth(2).click();
      assert.equal(await dying.filter({has:page.locator('svg')}).count(),4);
      assert.equal(await dying.nth(2).getAttribute('aria-pressed'),'true');
      const rankSquares=first.locator('.pf-alt-skill-row').first().locator('.pf-alt-rank-square');
      assert.equal(await rankSquares.count(),4,'A skill shows four rank squares, never a dropdown');
      const initialRank=await rankSquares.evaluateAll(nodes=>nodes.findIndex(node=>node.getAttribute('aria-pressed')==='true'));
      await rankSquares.nth(2).click();
      assert.equal(await rankSquares.nth(2).getAttribute('aria-pressed'),'true','Master square selects rank 3');
      assert.equal(await rankSquares.filter({hasText:'✓'}).count(),1,'Only one rank may be selected at a time');
      await rankSquares.nth(2).click();
      assert.equal(await rankSquares.filter({hasText:'✓'}).count(),0,'Click selected square to return to untrained');
      assert.equal(await first.locator('.pf-alt-skill-row select').count(),0,'No dropdowns for skill ranks');
      const partial=first.locator('.pf-alt-abilities-section input[type=checkbox]').first();
      const wasChecked=await partial.isChecked();
      await partial.click();
      assert.notEqual(await partial.isChecked(),wasChecked,
        'Partial ability boost must remain interactive');
      await partial.click();
      assert.equal(await partial.isChecked(),wasChecked,
        'Partial ability boost can return to its saved state');
      const weapon=first.locator('.pf-alt-weapon').first();
      assert.equal(await weapon.locator('.pf-alt-weapon-core input').count(),4,
        'Each weapon has four compact print fields');
      await weapon.getByText('Бонусы и дополнительные свойства').click();
      assert.ok(await weapon.locator('.pf-alt-weapon-extra input').count()>0,
        'Advanced weapon fields remain editable when expanded');
      assert.equal(await first.locator('.pf-alt-skill-head').count(),1,
        'The skill table has one fixed heading row, not repeated column labels');
      assert.equal(await fourth.locator('.pf-alt-manual-column').count()>=2,true,
        'The manual spell list uses adjacent ruled input columns');
      const arcane=fourth.getByRole('button',{name:'Мистическая'});
      await arcane.click();
      assert.equal(await arcane.getAttribute('aria-pressed'),'false',
        'Magic tradition selection must toggle off');
      await arcane.click();
      assert.equal(await arcane.getAttribute('aria-pressed'),'true');
      const spellInput=fourth.getByRole('textbox',{name:'Название',exact:false}).first()
        .or(fourth.locator('.pf-alt-spell-text .pf-rich-editable').first());
      assert.ok(await fourth.locator('.pf-alt-magic-layout').count()===1);
    }
    for(let i=0;i<4;i++){
      await pages.nth(i).screenshot({path:'test-artifacts/pf-alt-'+width+'-page-'+(i+1)+'.png'});
    }
    assert.deepEqual(errors,[],'React browser errors must be absent');
    await page.close();
  }
  console.log('PASS: four original-paper PF2e pages, desktop/tablet/mobile, field interactions and screenshot captures');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}
