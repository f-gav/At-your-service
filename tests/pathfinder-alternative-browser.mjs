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
    const badge=await pages.first().locator('.pf-alt-p1-logo-art').evaluate(el=>{
      const box=el.getBoundingClientRect(),img=el.querySelector('img').getBoundingClientRect();
      // Bounds of the badge and its low left flourish in the original PDF raster.
      const project=(x,y)=>({x:img.left+x*img.width/3005,y:img.top+y*img.width/3005});
      return {box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},
        upperLeft:project(125,90),lowerRight:project(990,265),flourish:project(200,285)};
    });
    for(const point of [badge.upperLeft,badge.lowerRight,badge.flourish]){
      assert.ok(point.x>=badge.box.left&&point.x<=badge.box.right&&
        point.y>=badge.box.top&&point.y<=badge.box.bottom,
        'Entire Pathfinder badge and flourish must fit the responsive crop');
    }
    const typography=await pages.first().evaluate(root=>({
      weights:[...root.querySelectorAll('.pf-alt-ability>.pf-alt-field:first-child>span')]
        .map(el=>getComputedStyle(el).fontWeight),
      headings:[...root.querySelectorAll('.pf-alt-p1-heading,.pf-alt-section>h3')]
        .map(el=>({border:getComputedStyle(el).borderBottomColor,
          rule:getComputedStyle(el,'::after').position,
          width:parseFloat(getComputedStyle(el,'::after').width)}))
    }));
    assert.ok(typography.weights.length===6&&typography.weights.every(x=>x==='600'),
      'All six ability names use a lighter semibold weight');
    assert.ok(typography.headings.every(x=>x.border==='rgba(0, 0, 0, 0)'&&x.rule==='static'&&x.width>=8),
      'First-page headings have inline paper rules and no underline');
    const defense=pages.first().locator('.pf-paper-defense-row');
    assert.equal(await defense.locator('.pf-paper-defenses>h3').innerText(),'ЗАЩИТЫ');
    assert.equal(await defense.locator('.pf-paper-frame--armor').count(),1);
    assert.equal(await defense.locator('.pf-paper-frame--shield').count(),1);
    assert.equal(await defense.locator('.pf-paper-frame--save').count(),3);
    assert.equal(await defense.locator('.pf-paper-heart').getByRole('textbox',{name:'Максимум ПЗ',exact:true}).inputValue(),'67');
    const defenseBounds=await defense.evaluate(root=>{
      const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};
      return {box:rect(root),controls:[...root.querySelectorAll('input,button')].map(rect),
        saves:[...root.querySelectorAll('.pf-paper-save')].map(el=>({
          total:rect(el.querySelector('.pf-paper-save-total')),
          rank:rect(el.querySelector('.pf-alt-rank-field')),
          formula:rect(el.querySelector('.pf-paper-formula'))})),
        notes:rect(root.querySelector('.pf-paper-saves>.pf-alt-field')),
        healthNotes:[...root.querySelectorAll('.pf-paper-health-notes>.pf-alt-field')].map(rect)};
    });
    assert.ok(defenseBounds.controls.every(r=>r.left>=defenseBounds.box.left-1&&r.right<=defenseBounds.box.right+1),
      'Every defense and health control stays inside the paper at '+width+'px');
    assert.ok(defenseBounds.saves.every(x=>x.rank.left>=x.total.right&&x.formula.top>=x.total.bottom),
      'Save ranks sit to the right; calculations sit below their framed totals');
    assert.ok(defenseBounds.notes.top>Math.max(...defenseBounds.saves.map(x=>x.formula.bottom)),
      'Defense notes sit beneath all three save calculations');
    assert.ok(defenseBounds.healthNotes[1].top>=defenseBounds.healthNotes[0].bottom,
      'Resistances and conditions stack vertically');
    if(width===1440){
      const packing=await defense.evaluate(root=>{
        const rect=selector=>{const r=root.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        return {coat:rect('.pf-paper-coat'),shield:rect('.pf-paper-shield'),
          formula:rect('.pf-paper-armor-formula'),training:rect('.pf-paper-armor-training')};
      });
      assert.ok(packing.coat.width/packing.coat.height>1.3&&packing.shield.width/packing.shield.height>.65,
        'Armor and shield have the wider paper-reference proportions');
      assert.ok(packing.formula.top>=packing.coat.bottom&&packing.training.left>=packing.formula.right-2,
        'AC calculation sits under the coat and shield, beside armor training');
      const armorRanks=defense.locator('.pf-paper-armor-ranks .pf-alt-rank-field').first();
      const armorExpert=armorRanks.locator('button').nth(1);
      await armorExpert.click();
      assert.equal(await armorExpert.getAttribute('aria-pressed'),'true');
      assert.equal(await armorRanks.locator('button').filter({hasText:'✓'}).count(),0,
        'Armor ranks use filled squares without checkmarks');
      await armorExpert.click();assert.equal(await armorExpert.getAttribute('aria-pressed'),'false');
      const maximumHP=defense.getByRole('textbox',{name:'Максимум ПЗ',exact:true});
      for(const value of ['122','9999']){
        await maximumHP.fill(value);
        assert.equal(await maximumHP.inputValue(),value);
        assert.ok(await maximumHP.evaluate(input=>{
          const style=getComputedStyle(input),canvas=document.createElement('canvas');
          const context=canvas.getContext('2d');context.font=style.font;
          return context.measureText(input.value).width<=input.clientWidth;
        }),'Multi-digit maximum HP fits inside the heart');
      }
      await maximumHP.fill('122');
      const bottoms=await defense.evaluate(root=>({
        defenses:root.querySelector('.pf-paper-saves>.pf-alt-field').getBoundingClientRect().bottom,
        health:root.querySelector('.pf-paper-health-notes>.pf-alt-field:last-child').getBoundingClientRect().bottom
      }));
      assert.ok(Math.abs(bottoms.defenses-bottoms.health)<1,'Defense and health blocks end on one baseline');
      const shieldHP=defense.getByRole('textbox',{name:'ПЗ щита',exact:true});
      await shieldHP.fill('33');assert.equal(await shieldHP.inputValue(),'33');
      const operand=defense.getByRole('textbox',{name:'Вын',exact:true});
      await operand.fill('2');assert.equal(await operand.inputValue(),'2');
      const fortRank=defense.locator('.pf-paper-save').first().locator('.pf-alt-rank-square').nth(1);
      await fortRank.click();assert.equal(await fortRank.getAttribute('aria-pressed'),'true');
      const currentHP=defense.getByRole('textbox',{name:'Текущие ПЗ',exact:true});
      await currentHP.fill('48');assert.equal(await currentHP.inputValue(),'48');
      await defense.getByRole('textbox',{name:'Устойчивость и невосприимчивость',exact:true}).fill('Огонь 5');
    }
    await defense.screenshot({path:'test-artifacts/pf-alt-'+width+'-defenses.png'});
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
    assert.ok(metrics.every(m=>m.sectionCount>=(m.id==='pf-sheet-page-2'?2:4)),'Each page retains its sections');
    // All widths, including 360px, must stay inside the paper's scroll box.
    // Intentionally cropped source artwork can extend within overflow:hidden;
    // the actual page scrollWidth must still fit its clientWidth.
    assert.ok(metrics.every(m=>m.scrollW<=m.clientW+4),
      'Text inputs/columns must fit inside each HTML page: '+JSON.stringify(metrics.filter(m=>m.scrollW>m.clientW+4)));
    if(width===360){
      const controls=await pages.nth(3).locator('.pf-paper-magic .pf-alt-manual-cell .pf-text-size-controls').evaluateAll(nodes=>
        nodes.map(node=>{
          const rect=node.getBoundingClientRect();
          const paper=node.closest('.pf-alt-page')?.getBoundingClientRect();
          return {left:rect.left,right:rect.right,paperLeft:paper?.left,paperRight:paper?.right};
        }));
      assert.ok(controls.every(r=>r.left>=r.paperLeft-1&&r.right<=r.paperRight+1),
        'Every spell-table text-size control must stay inside the fourth page at 360px: '+JSON.stringify(controls));
    }
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
      assert.ok(strip.nameFonts.every(value=>value.includes('PF2e PDF DIN')),
        'Russian condensed sans-serif must be applied to ability names');
      assert.ok(strip.captions.every(x=>x.circleX<x.textX&&Math.abs(x.circleTop-x.textTop)<5),
        'A round boost marker precedes its text on one line');
      assert.ok(strip.rightBorders.every(value=>value==='0px'),
        'No vertical separators between abilities');
      assert.ok(strip.headingRuleWidth>80&&strip.headingBorder==='0px',
        'Characteristics rule continues to the right of its caption');
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
      assert.ok(topAlignment.abilityFont.includes('PF2e PDF DIN')&&
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
      const skills=first.locator('.pf-alt-skills-section');
      assert.equal(await skills.locator('.pf-alt-skill-row').count(),18);
      assert.equal(await skills.locator('.pf-paper-frame--skill').count(),18);
      const skillLayout=await skills.evaluate(root=>{
        const rows=[...root.querySelectorAll('.pf-alt-skill-row')];
        const notes=root.querySelector(':scope>.pf-alt-fields').getBoundingClientRect();
        return {lastBottom:rows.at(-1).getBoundingClientRect().bottom,notesBottom:notes.bottom,
          vertical:rows.every(row=>{const buttons=[...row.querySelectorAll('.pf-alt-rank-square')];
            return buttons.length===4&&buttons.every((b,i)=>i===0||b.getBoundingClientRect().top>=buttons[i-1].getBoundingClientRect().bottom-1);})};
      });
      assert.ok(skillLayout.vertical,'All skills use compact vertical rank columns');
      assert.ok(Math.abs(skillLayout.lastBottom-skillLayout.notesBottom)<2,'Notes extend to the last skill row');
      const footerTop=await first.locator('.pf-alt-page-footer').evaluate(el=>el.getBoundingClientRect().top);
      assert.ok(footerTop-skillLayout.lastBottom>=0&&footerTop-skillLayout.lastBottom<40,
        'Enlarged skills fill the working page height and end just above the footer');
      const notesEditor=skills.locator('.pf-rich-editable');
      const noteBounds=await notesEditor.evaluate(el=>({
        editor:el.getBoundingClientRect().height,host:el.parentElement.getBoundingClientRect().height
      }));
      assert.ok(noteBounds.editor>=noteBounds.host-25,'The editable notes surface fills its full rectangle');
      await notesEditor.fill('Заметки доступны по всей высоте поля.');
      assert.equal(await notesEditor.innerText(),'Заметки доступны по всей высоте поля.');
      const din=await first.evaluate(async root=>{
        const faces=await document.fonts.load('700 23px "PF2e PDF DIN"','0123456789');
        return {loaded:faces.length,level:getComputedStyle(root.querySelector('.pf-alt-p1-level-diamond input')).fontFamily};
      });
      assert.ok(din.loaded>0&&din.level.includes('PF2e PDF DIN')&&!din.level.includes('Georgia'),
        'Embedded DIN Pro must load and render the level without serifs');
      const nameSpacing=await skills.locator('.pf-alt-skill-row').evaluateAll(rows=>rows.filter(row=>row.querySelector(':scope>b')).map(row=>{
        const label=row.querySelector(':scope>b'),range=document.createRange();range.selectNodeContents(label);
        const text=range.getBoundingClientRect(),frame=row.querySelector('.pf-paper-skill-total').getBoundingClientRect();
        return {name:label.textContent,gap:frame.left-text.right,left:text.left-row.getBoundingClientRect().left};
      }));
      assert.ok(nameSpacing.every(x=>x.gap>=5&&x.left>=0),
        'Long skill names stay inside their column with a clear gap before totals: '+JSON.stringify(nameSpacing));
      const lore=skills.getByRole('textbox',{name:'Область знания I',exact:true});
      await lore.fill('Море');assert.equal(await lore.inputValue(),'Море');
      await skills.screenshot({path:'test-artifacts/pf-alt-skills-desktop.png'});
      const rankSquares=first.locator('.pf-alt-skill-row').first().locator('.pf-alt-rank-square');
      assert.equal(await rankSquares.count(),4,'A skill shows four rank squares, never a dropdown');
      const initialRank=await rankSquares.evaluateAll(nodes=>nodes.findIndex(node=>node.getAttribute('aria-pressed')==='true'));
      await rankSquares.nth(2).click();
      assert.equal(await rankSquares.nth(2).getAttribute('aria-pressed'),'true','Master square selects rank 3');
      assert.equal(await rankSquares.filter({hasText:'✓'}).count(),0,'Skill ranks are filled without checkmarks');
      assert.equal(await rankSquares.locator('visible=true').count(),4);
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
      assert.equal(await weapon.locator('.pf-paper-weapon-line input').count(),9,
        'Weapon name, total, three operands, damage and three damage types are visible');
      if(await weapon.locator('.pf-alt-weapon-more').count()){
        await weapon.getByText('Бонусы и дополнительные свойства').click();
        assert.ok(await weapon.locator('.pf-alt-weapon-extra input').count()>0);
      }
      assert.equal(await first.locator('.pf-paper-frame--axe').count(),3);
      assert.equal(await first.locator('.pf-paper-frame--dart').count(),2);
      assert.equal(await first.locator('.pf-paper-damage-types input').count(),15);
      const damageTypes=weapon.locator('.pf-paper-damage-types input');
      await damageTypes.nth(0).check();await damageTypes.nth(1).check();
      assert.equal(await damageTypes.nth(0).isChecked(),false,'Weapon damage types remain exclusive');
      assert.equal(await damageTypes.nth(1).isChecked(),true);
      const perceptionRank=first.locator('.pf-paper-perception-top .pf-alt-rank-square').nth(1);
      await perceptionRank.click();assert.equal(await perceptionRank.getAttribute('aria-pressed'),'true');
      assert.equal(await perceptionRank.innerText(),'','Perception rank uses fill without checkmark');
      for(const [selector,value] of [['.pf-paper-eye','+13'],['.pf-paper-arrow','30'],['.pf-paper-frame--dart','+13']]){
        const shape=selector.includes('frame')?first.locator(selector).first().locator('..'):first.locator(selector).first();
        const input=shape.locator('input');
        await input.fill(value);assert.equal(await input.inputValue(),value);
        assert.ok(await input.evaluate(el=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=getComputedStyle(el).font;return ctx.measureText(el.value).width<el.clientWidth-2;}),
          'Signed values fit the enlarged perception, speed and ranged-attack icons');
      }
      const defenseHost=first.locator('#pf-alt-defense_notes');
      await defenseHost.getByRole('button',{name:'Увеличить текст: Примечания',exact:true}).click();
      assert.equal(await defenseHost.locator('.pf-rich-editable').evaluate(el=>getComputedStyle(el).fontSize),'13px');
      await defenseHost.getByRole('button',{name:'Уменьшить текст: Примечания',exact:true}).click();
      assert.equal(await defenseHost.locator('.pf-rich-editable').evaluate(el=>getComputedStyle(el).fontSize),'12px');
      const bodyFonts=await defenseHost.locator('.pf-rich-editable').evaluate(el=>getComputedStyle(el).fontFamily);
      assert.ok(!bodyFonts.includes('PF2e PDF DIN Bold'),bodyFonts);
      await first.locator('.pf-alt-main-right').screenshot({path:'test-artifacts/pf-alt-right-desktop.png'});
      assert.equal(await first.locator('.pf-alt-skill-head').count(),0,
        'Skill calculations have their own captions, without a shared table header');
      assert.equal(await fourth.locator('.pf-alt-manual-column').count()>=2,true,
        'The manual spell list uses adjacent ruled input columns');
      assert.equal(await fourth.locator(':scope>.pf-alt-heading:visible').count(),0);
      assert.equal(await fourth.locator('.pf-paper-slots .pf-paper-book').count(),10);
      const slotTops=await fourth.locator('.pf-paper-slots .pf-paper-book').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));
      assert.ok(slotTops.every(y=>Math.abs(y-slotTops[0])<1),'All ten daily spell slots share one paper row');
      const remaining=fourth.getByRole('textbox',{name:'Осталось ячеек 1',exact:true});
      await remaining.fill('2');assert.equal(await remaining.inputValue(),'2');
      const magicRank=fourth.locator('.pf-paper-cast-group').first().locator('.pf-alt-rank-square').nth(1);
      await magicRank.click();assert.equal(await magicRank.getAttribute('aria-pressed'),'true');
      assert.equal(await magicRank.innerText(),'','Magic proficiency uses filled squares without checkmarks');
      await fourth.locator('.pf-paper-magic').screenshot({path:'test-artifacts/pf-alt-magic-desktop.png'});
      const sector=fourth.getByRole('button',{name:'Сектор: Оккультная',exact:true});
      const occult=fourth.getByRole('button',{name:'Оккультная',exact:true});
      const originalOccult=await sector.getAttribute('aria-pressed');
      await sector.click();
      assert.notEqual(await sector.getAttribute('aria-pressed'),originalOccult);
      assert.equal(await sector.getAttribute('aria-pressed'),await occult.getAttribute('aria-pressed'));
      await sector.click();
      assert.equal(await sector.getAttribute('aria-pressed'),originalOccult);
      const arcane=fourth.getByRole('button',{name:'Мистическая',exact:true});
      await arcane.click();
      assert.equal(await arcane.getAttribute('aria-pressed'),'false',
        'Magic tradition selection must toggle off');
      await arcane.click();
      assert.equal(await arcane.getAttribute('aria-pressed'),'true');
      const spellInput=fourth.getByRole('textbox',{name:'Название',exact:false}).first()
        .or(fourth.locator('.pf-alt-spell-text .pf-rich-editable').first());
      assert.ok(await fourth.locator('.pf-alt-magic-layout').count()===1);
    }
    const biography=pages.nth(2).locator('.pf-paper-biography');
    assert.equal(await pages.nth(2).locator(':scope>.pf-alt-heading:visible').count(),0);
    if(width===1440){
      const geometry=await biography.evaluate(root=>{
        const portrait=root.querySelector('.pf-alt-portrait').getBoundingClientRect();
        const fields=[...root.querySelectorAll('.pf-alt-appearance-fields>.pf-alt-field')].slice(0,7).map(el=>el.getBoundingClientRect());
        return {tops:fields.map(r=>r.top),portraitBottom:portrait.bottom,
          lastBottom:root.querySelector('.pf-alt-personality-fields>.pf-alt-field:last-child').getBoundingClientRect().bottom};
      });
      assert.ok(geometry.tops.every(x=>Math.abs(x-geometry.tops[0])<1),'All seven appearance details share one paper row');
      assert.ok(Math.abs(geometry.portraitBottom-geometry.lastBottom)<2,'Portrait and personality end on one baseline');
      const likes=biography.getByRole('textbox',{name:'Любит',exact:true});await likes.fill('Книги и путешествия');assert.equal(await likes.inputValue(),'Книги и путешествия');
      const edicts=biography.getByRole('textbox',{name:'Наказы',exact:true});await edicts.fill('Беречь знания');assert.equal(await edicts.innerText(),'Беречь знания');
      assert.ok(await biography.getByRole('button',{name:'Изменить портрет',exact:true}).isEnabled());
      await biography.screenshot({path:'test-artifacts/pf-alt-biography-desktop.png'});
    }
    const actions=pages.nth(2).locator('.pf-paper-actions');
    assert.equal(await actions.locator('.pf-alt-action-card').count(),8);
    assert.equal(await actions.locator('.pf-alt-action-card>h4').count(),0);
    if(width===1440){
      const firstAction=actions.locator('.pf-paper-action').first();
      assert.equal(await firstAction.getByRole('textbox',{name:'Стр.',exact:true}).inputValue(),'1');
      const tops=await firstAction.locator('.pf-paper-action-top>.pf-alt-field').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));
      assert.ok(tops.length===4&&tops.every(y=>Math.abs(y-tops[0])<1),'Action header fields stay on one line');
      await firstAction.getByRole('textbox',{name:'Название',exact:true}).fill('Шаг');
      await firstAction.getByRole('textbox',{name:'Эффекты',exact:true}).fill('Переместиться на 5 футов.');
      const free=actions.getByRole('button',{name:'Свободное действие 1',exact:true}),reaction=actions.getByRole('button',{name:'Ответное действие 1',exact:true});
      await free.click();assert.equal(await free.getAttribute('aria-pressed'),'true');
      await reaction.click();assert.equal(await reaction.getAttribute('aria-pressed'),'true');assert.equal(await free.getAttribute('aria-pressed'),'false');
      await actions.screenshot({path:'test-artifacts/pf-alt-actions-desktop.png'});
    }
    const campaign=pages.nth(2).locator('.pf-paper-campaign');
    if(width===1440){
      const boxes=await campaign.locator('.pf-alt-campaign-grid>.pf-alt-field').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,top:r.top,bottom:r.bottom}}));
      assert.ok(Math.abs(boxes[0].width-boxes[1].width)<1,'Campaign notes have equal-width columns');
      assert.ok(Math.abs(boxes[0].top-boxes[1].top)<1&&Math.abs(boxes[0].bottom-boxes[3].bottom)<1,
        'Campaign notes and three side fields share top and bottom baselines');
      const notes=campaign.getByRole('textbox',{name:'Заметки',exact:true});
      assert.ok((await notes.innerText()).includes('Исследование руин'));
      const ally=campaign.getByRole('textbox',{name:'Союзники',exact:true});await ally.fill('Союз магов');assert.equal(await ally.innerText(),'Союз магов');
      await campaign.screenshot({path:'test-artifacts/pf-alt-campaign-desktop.png'});
    }
    const equipment=pages.nth(1).locator('.pf-paper-equipment');
    assert.equal(await equipment.locator('.pf-alt-inventory-group').count(),3);
    const wornColumns=await equipment.locator('.pf-paper-worn .pf-alt-field').evaluateAll(nodes=>nodes.map(el=>({left:el.getBoundingClientRect().left,top:el.getBoundingClientRect().top})));
    assert.equal(wornColumns.length,3);
    assert.ok(wornColumns.every((x,i)=>Math.abs(x.top-wornColumns[0].top)<1&&(i===0||x.left>wornColumns[i-1].left)),
      'Worn items, attunement and bulk are three adjacent columns');
    assert.deepEqual(await equipment.locator('.pf-alt-coin .pf-alt-field>span').allTextContents(),['ММ','СМ','ЗМ','ПМ']);
    if(width===1440){
      const held=equipment.locator('.pf-paper-held .pf-rich-editable').first();
      assert.ok((await held.innerText()).includes('Свёрток с рунами'),'Existing inventory contents remain readable');
      const originalText=await held.innerText();
      await held.fill('Предмет один\nПредмет два\nПредмет три');
      assert.ok((await held.innerText()).includes('Предмет три'),'Inventory accepts multiline text');
      const sizeGroup=equipment.locator('#pf-alt-inventory_held .pf-text-size-controls');
      const originalSize=Number(await sizeGroup.locator('output').innerText());
      await sizeGroup.getByRole('button',{name:/Увеличить текст/}).click();
      assert.equal(Number(await sizeGroup.locator('output').innerText()),originalSize+1,'Inventory text size is adjustable');
      assert.ok((await held.innerText()).includes('Предмет три'),'Resizing must not erase inventory');
      await held.fill(originalText);
      await equipment.locator('.pf-paper-bag input').fill('8');
      assert.equal(await equipment.locator('.pf-paper-bag input').inputValue(),'8');
      assert.deepEqual(await equipment.locator('.pf-alt-coin input').evaluateAll(nodes=>nodes.map(el=>el.value)),['45','34','23','12'],
        'Coin labels match the semantic values in copper, silver, gold and platinum order');
      const gold=equipment.getByRole('textbox',{name:'ЗМ',exact:true});await gold.fill('27');assert.equal(await gold.inputValue(),'27');
      const attunement=equipment.locator('.pf-paper-worn .pf-rich-editable').nth(1);await attunement.fill('1');assert.equal(await attunement.innerText(),'1');
      await equipment.screenshot({path:'test-artifacts/pf-alt-equipment-desktop.png'});
    }
    const advancement=pages.nth(1).locator('.pf-alt-dynamic-advancement');
    assert.equal(await advancement.count(),1,'Alternative page reuses dynamic advancement');
    if(width===1440){
      const rows=advancement.locator('.pf-advancement-row');
      const before=await rows.count();
      await advancement.getByRole('button',{name:'Добавить уровень',exact:true}).click();
      assert.equal(await rows.count(),before+1,'Add creates one next level, preserving previous levels');
      const firstEditor=advancement.locator('.pf-advancement-row-first .pf-rich-editable').first();
      assert.ok((await firstEditor.innerText()).includes('Эльф-провидец'));
      assert.equal(await firstEditor.locator('b').innerText(),'Эльф-провидец');
      assert.ok(!(await firstEditor.innerText()).includes('ays:rich:v1:'));
      const original=await firstEditor.innerText();
      const beforeHeight=await pages.nth(1).evaluate(el=>el.getBoundingClientRect().height);
      await firstEditor.fill(Array.from({length:90},(_,i)=>'Строка способности '+i).join('\n'));
      assert.ok(await pages.nth(1).evaluate(el=>el.getBoundingClientRect().height)>beforeHeight+100,
        'Long advancement entries grow the level and the HTML page');
      await firstEditor.fill(original);
      await advancement.getByRole('button',{name:'Удалить уровень '+(before+1),exact:true}).click();
      const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Отмена',exact:true}).click();
      assert.equal(await rows.count(),before+1,'Cancel preserves the level');
      await advancement.getByRole('button',{name:'Удалить уровень '+(before+1),exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:'Удалить',exact:true}).click();
      assert.equal(await rows.count(),before,'Confirmed removal compacts the existing level model');
      await advancement.screenshot({path:'test-artifacts/pf-alt-advancement-desktop.png'});
    }
    for(let i=0;i<4;i++){
      await pages.nth(i).screenshot({path:'test-artifacts/pf-alt-'+width+'-page-'+(i+1)+'.png'});
    }
    if(width===360){
      // A selected phrase summons a portalled toolbar; it must stay inside a
      // narrow phone viewport rather than using the desktop 370px width.
      const editor=pages.nth(1).locator('.pf-paper-held .pf-rich-editable').first();
      await editor.evaluate(el=>{
        el.focus();
        const firstText=[...el.childNodes].find(node=>node.textContent?.trim());
        if(!firstText)throw new Error('Inventory fixture must contain selectable text');
        const selection=window.getSelection(),range=document.createRange();
        range.selectNodeContents(firstText);
        selection?.removeAllRanges();selection?.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      });
      // The selection toolbar may be dismissed by asynchronous viewport
      // events. Check its visible bounds in a single browser frame, rather
      // than racing a separate waitFor() against boundingBox().
      await page.waitForFunction((limit)=>{
        const toolbar=document.querySelector('.pf-rich-toolbar');
        if(!toolbar)return false;
        const rect=toolbar.getBoundingClientRect();
        return rect.width>0&&rect.height>0&&rect.left>=0&&rect.right<=limit+1;
      },width,{timeout:10000});
      await editor.press('Escape');
    }
    assert.deepEqual(errors,[],'React browser errors must be absent');
    await page.close();
  }
  const libraryPage=await browser.newPage({viewport:{width:1440,height:900}});
  await libraryPage.goto(base+'tests/pdf-harness.html?system=pf2e&variant=alternative&spells=library',{waitUntil:'networkidle'});
  const magic=libraryPage.locator('.pf-paper-magic');
  const geometry=await magic.evaluate(el=>{
    const box=selector=>el.querySelector(selector).getBoundingClientRect();
    const left=box('.pf-alt-magic-left'),right=box('.pf-alt-magic-right');
    const book=box('.pf-paper-panel-spellbook .pf-alt-spell-column');
    const ritual=box('.pf-paper-panel-rituals');
    return {leftEnd:left.bottom,rightEnd:right.bottom,bookHeight:book.height,ritualTop:ritual.top,bookEnd:book.bottom,
      borders:[...el.querySelectorAll('.pf-alt-spell-column')].map(x=>getComputedStyle(x).borderTopWidth)};
  });
  assert.ok(Math.abs(geometry.leftEnd-geometry.rightEnd)<2,JSON.stringify(geometry));
  assert.ok(geometry.bookHeight>700&&geometry.ritualTop>geometry.bookEnd,JSON.stringify(geometry));
  assert.ok(geometry.borders.every(x=>x==='1px'),JSON.stringify(geometry));
  await magic.screenshot({path:'test-artifacts/pf-alt-magic-library-desktop.png'});
  const toolBorders=await magic.locator('.pf-paper-magic-tools>button').evaluateAll(nodes=>nodes.map(el=>({width:getComputedStyle(el).borderTopWidth,color:getComputedStyle(el).borderTopColor})));
  assert.ok(toolBorders.every(b=>b.width==='1px'&&b.color==='rgb(49, 92, 68)'));
  await magic.getByRole('button',{name:'Открыть гримуар',exact:true}).click();
  const grimoire=libraryPage.getByRole('dialog',{name:'Гримуар заклинаний',exact:true});
  await grimoire.locator('.pf-grimoire-item').first().waitFor();
  await grimoire.locator('.pf-grimoire-item').first().getByRole('button',{name:/^Подготовить /}).click();
  await grimoire.getByRole('button',{name:'Закрыть гримуар'}).click();
  const spellRow=magic.locator('.pf-alt-spell-row').first();
  await spellRow.waitFor();
  const selectedSpellName=(await spellRow.locator('strong').innerText()).trim();
  await spellRow.click();
  const spellDetail=libraryPage.getByRole('dialog',{name:'Заклинание '+selectedSpellName,exact:true});
  await spellDetail.waitFor();
  assert.equal(await spellDetail.locator('h2').innerText(),selectedSpellName,
    'Clicking a prepared spell row must open that exact spell card, not the grimoire');
  assert.equal(await grimoire.count(),0,'Prepared spell row must not reopen the grimoire');
  await spellDetail.getByRole('button',{name:'Закрыть карточку заклинания'}).click();
  assert.equal(await spellDetail.count(),0,'Spell card closes without altering the selection');
  for(const panel of ['cantrip','focus','innate','spellbook','rituals']){
    const areas=magic.locator('.pf-paper-panel-'+panel+' .pf-alt-spell-area');
    for(let i=0;i<await areas.count();i++){
      const area=areas.nth(i);
      await area.click({position:{x:15,y:(await area.boundingBox()).height-15}});
      await grimoire.waitFor();
      await grimoire.getByRole('button',{name:'Закрыть гримуар'}).click();
    }
  }
  await magic.locator('.pf-alt-spell-area').first().focus();
  await libraryPage.keyboard.press('Enter');await grimoire.waitFor();
  await grimoire.getByRole('button',{name:'Закрыть гримуар'}).click();

  // Regression: the sheet's class settings (not the separate public library)
  // must offer Necromancer and expose its class-exclusive focus magic.
  await magic.getByRole('button',{name:'Настройки магии'}).click();
  const spellSettings=libraryPage.getByRole('dialog',{name:'Настройки заклинаний'});
  await spellSettings.waitFor();
  const necromancer=spellSettings.getByRole('checkbox',{name:'Некромант'});
  assert.ok(await necromancer.isVisible(),'Necromancer checkbox is available in the sheet settings');
  await necromancer.check();
  assert.ok(await necromancer.isChecked());
  await spellSettings.getByRole('button',{name:'Закрыть настройки заклинаний'}).click();
  await magic.getByRole('button',{name:'Открыть гримуар',exact:true}).click();
  await grimoire.locator('.pf-grimoire-item').filter({hasText:'Создание прислужника'}).waitFor();
  const thrall=grimoire.locator('.pf-grimoire-item').filter({hasText:'Создание прислужника'});
  const spear=grimoire.locator('.pf-grimoire-item').filter({hasText:'Костяное копьё'});
  await thrall.getByRole('button',{name:'Подготовить Создание прислужника'}).click();
  await spear.getByRole('button',{name:'Подготовить Костяное копьё'}).click();
  await grimoire.getByRole('button',{name:'Закрыть гримуар'}).click();
  assert.ok(await magic.locator('.pf-paper-panel-cantrip .pf-alt-spell-row')
    .filter({hasText:'Создание прислужника'}).isVisible(),
    'Create Thrall is rendered in the Cantrips panel, not as a spell slot');
  assert.ok(await magic.locator('.pf-paper-panel-focus .pf-alt-spell-row')
    .filter({hasText:'Костяное копьё'}).isVisible(),
    'Bone Spear is rendered in the Focus Spell panel');
  await libraryPage.close();

  // The save simulator delays responses to exercise edits made during an
  // outstanding request. A later value must receive its own cloud write.
  const savePage=await browser.newPage();
  await savePage.goto(base+'tests/pdf-harness.html?system=pf2e&variant=alternative&save=test',{waitUntil:'networkidle'});
  const saveName=savePage.getByRole('textbox',{name:'Имя персонажа',exact:true});
  await saveName.fill('Первый вариант');
  await savePage.waitForFunction(()=>window.__pfSaveEvents?.length>=1);
  await saveName.fill('Последний вариант');
  await savePage.waitForFunction(()=>window.__pfSaveEvents?.length>=2);
  await savePage.locator('.auto-save-saved').waitFor();
  const saves=await savePage.evaluate(()=>window.__pfSaveEvents.map(entry=>entry.name));
  assert.deepEqual(saves,['Первый вариант','Последний вариант'],
    'An in-flight request must not swallow a newer character edit');
  const remainingDraft=await savePage.evaluate(()=>
    Object.keys(localStorage).filter(key=>key.includes('ays-unsaved-draft-v1:')));
  assert.equal(remainingDraft.length,0,'Acknowledged final edit must clear its emergency draft');
  await savePage.close();

  const failContext=await browser.newContext();
  const failPage=await failContext.newPage();
  const failUrl=base+'tests/pdf-harness.html?system=pf2e&variant=alternative&save=test&fail=1';
  await failPage.goto(failUrl,{waitUntil:'networkidle'});
  await failPage.getByRole('textbox',{name:'Имя персонажа',exact:true}).fill('Несохранённый черновик');
  await failPage.locator('.auto-save-error').waitFor();
  const storedDraft=await failPage.evaluate(()=>
    Object.keys(localStorage).find(key=>key.includes('ays-unsaved-draft-v1:')));
  assert.ok(storedDraft,'Failed cloud save must retain a local emergency draft');
  await failPage.reload({waitUntil:'networkidle'});
  assert.equal(await failPage.getByRole('textbox',{name:'Имя персонажа',exact:true}).inputValue(),
    'Несохранённый черновик','Reload must recover the failed save when cloud baseline has not changed');
  await failContext.close();
  console.log('PASS: four original-paper PF2e pages, desktop/tablet/mobile, autosave sequencing and emergency recovery');
}finally{
 if(browser)await browser.close();
 server.kill('SIGTERM');
}


