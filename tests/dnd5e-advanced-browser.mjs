import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=4218,origin='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-classic2014-harness.html';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
  '--port',String(port),'--strictPort'],{stdio:'ignore',env:{...process.env,
  VITE_BASE_PATH:'/At-your-service/',VITE_SUPABASE_URL:'',VITE_SUPABASE_PUBLISHABLE_KEY:''}});
let browser;
try{
  let ready=false;
  for(let t=0;t<100;t++){
    try{if((await fetch(origin)).ok){ready=true;break;}}catch{/* boot */}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(ready,'Advanced D&D browser test harness failed');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:390,height:900}});
  page.on('dialog',dialog=>dialog.accept());
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(origin+'?edition=2024',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/Открыть Гримуар, ресурсы и бонусы/}).click();
    const advanced=page.locator('[data-dndadvanced="1"]');
    await advanced.getByRole('button',{name:'Гримуар',exact:true}).click();
    await advanced.getByRole('button',{name:'+ Заклинание'}).click();
    const entry=advanced.locator('.dndadvanced-entry').first();
    await entry.locator('input[aria-label^="Название заклинания"]').fill('Щит');
    await entry.getByRole('checkbox',{name:/Известно/}).check();
    await entry.getByRole('checkbox',{name:/Подготовлено/}).check();
    await entry.locator('.pf-rich-editable').fill('Реакция: защита от удара');
    await advanced.getByRole('button',{name:'Мультикласс'}).click();
    await advanced.getByRole('button',{name:'+ Класс'}).click();
    await advanced.getByLabel('Прогрессия класса 0').selectOption('full');
    assert.match(await advanced.innerText(),/Объединённый уровень заклинателя: 3/);
    await advanced.getByRole('button',{name:'+ Класс'}).click();
    await advanced.getByLabel('Прогрессия класса 1').selectOption('pact');
    await advanced.getByRole('button',{name:'Применить рассчитанные ячейки'}).click();
    await advanced.getByRole('button',{name:'Гримуар'}).click();
    await advanced.getByLabel('Источник ячеек для заклинания').selectOption('pact');
    await advanced.getByRole('spinbutton',{name:'Круг ячейки для сотворения'}).fill('1');
    await advanced.getByRole('button',{name:/Сотворить/}).click();
    assert.match(await advanced.innerText(),/Колдун|Договор|Договор колдуна/);
    await advanced.getByRole('button',{name:'Ресурсы'}).click();
    await advanced.getByRole('button',{name:'+ Ресурс'}).click();
    const resource=advanced.locator('.dndadvanced-entry').first();
    await resource.locator('input[aria-label^="Имя ресурса"]').fill('Вдохновение');
    await resource.locator('button[aria-label^="Потратить ресурс"]').click();
    assert.match(await resource.innerText(),/0 \/ 1/);
    await advanced.getByRole('button',{name:'Длинный отдых'}).click();
    assert.match(await resource.innerText(),/1 \/ 1/);
    await advanced.getByRole('button',{name:'Эффекты'}).click();
    await advanced.getByRole('button',{name:'+ Эффект'}).click();
    await advanced.locator('input[aria-label^="Состояние эффекта"]').fill('poisoned');
    await page.getByLabel('2024 значение ЛОВКОСТЬ').fill('18');
    // The effects panel shows condition consequences, and rules read it instantly.
    assert.match(await advanced.innerText(),/Помеха на атаки: да/);
    await advanced.getByRole('button',{name:'Бонусы'}).click();
    await advanced.getByRole('button',{name:'+ Бонус'}).click();
    await advanced.locator('input[aria-label^="Формула бонуса"]').fill('floor([LVL]/2)');
    await advanced.locator('input[aria-label^="Формула бонуса"]').blur();
    await advanced.getByLabel('D&D формула броска').fill('1d20+3');
    await advanced.getByRole('button',{name:'Бросить формулу LSS'}).click();
    await page.getByLabel('Локальные броски костей').locator('.ays-dice-history .ays-dice-result').first().waitFor();
    await page.getByRole('button',{name:'Лист 2014'}).click();
    await page.locator('[data-dnd-classic-version="2014"]').waitFor();
    await page.getByRole('button',{name:'Лист 2024'}).click();
    await page.locator('[data-dnd-classic-version="2024"]').waitFor();
    await page.waitForFunction(()=>window.__AYS_DND_2014_TEST__.saves.some(
      row=>row.details.dnd5eSheet.spellcasting.spells.some(s=>s.name==='Щит')&&
        row.details.dnd5eSheet.progression?.classes?.length===2&&
        row.details.dnd5eSheet.resources?.length===1&&row.details.dnd5eSheet.effects?.length===1&&
        row.details.dnd5eSheet.bonuses?.length===1),null,{timeout:18000});
    const saved=await page.evaluate(()=>window.__AYS_DND_2014_TEST__.saves.at(-1));
    assert.equal(saved.details.dnd5eSheet.spellcasting.spells[0].known,true);
    assert.equal(saved.details.dnd5eSheet.spellcasting.spells[0].prepared,true);
    assert.equal(saved.details.dnd5eSheet.spellcasting.slots.pact['1'].used,0,
      'Long rest must restore pact slots');
    assert.equal(saved.details.dnd5eSheet.resources[0].current,1);
    assert.equal(saved.details.dnd5eSheet.rulesEdition,'2024');
    assert.equal(saved.details.dnd5eSheet.layoutEdition,'2024');
    assert.equal(saved.details.notes,'Общий дополнительный текст');
    assert.deepEqual(errors,[],'Browser application errors');
    console.log('PASS D&D 2024 advanced UI: grimoire, pact slots, multiclass, rest, effect, bonus, dice, cross-edition save');
  }finally{await page.close();}
}finally{if(browser)await browser.close();vite.kill('SIGTERM');}
