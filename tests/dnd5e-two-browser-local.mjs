// Two Chromium browser contexts, one genuine local Supabase Auth identity,
// and the actual Classic2014Sheet editor using fixture-only PostgREST CAS.
// Does NOT validate production character-repository CAS schema.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {createClient} from '@supabase/supabase-js';

const vars=Object.fromEntries(readFileSync('.local-supabase-status','utf8')
 .split(/\r?\n/).filter(x=>x.includes('=')).map(x=>{
  const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).replace(/^["']|["']$/g,'')];
 }));
assert.match(vars.API_URL||'',/^http:\/\/(localhost|127\.0\.0\.1):54321$/);
assert.ok(vars.ANON_KEY);
const pg={...process.env,PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',
 PGPASSWORD:'postgres',PGDATABASE:'postgres'};
const sql=q=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-At','-c',q],
 {env:pg,encoding:'utf8'}).trim();
sql('ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0');
sql('GRANT UPDATE (revision) ON public.characters TO authenticated');
sql("NOTIFY pgrst, 'reload schema'");
const email='ays-two-browsers-'+randomUUID()+'@example.test',password='Local-'+randomUUID();
const first=createClient(vars.API_URL,vars.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const signed=await first.auth.signUp({email,password});
assert.ifError(signed.error);
assert.ok(signed.data.session);
const second=createClient(vars.API_URL,vars.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await second.auth.signInWithPassword({email,password});
assert.ifError(login.error);
assert.ok(login.data.session);
const owner=signed.data.user.id;
assert.equal(login.data.user.id,owner);
const port=4234;
const url='http://127.0.0.1:'+port+'/At-your-service/tests/dnd5e-local-auth-harness.html';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
 '--port',String(port),'--strictPort'],{stdio:'ignore',
 env:{...process.env,VITE_BASE_PATH:'/At-your-service/',VITE_SUPABASE_URL:'',
 VITE_SUPABASE_PUBLISHABLE_KEY:''}});
let browser;
try{
 let ready=false;
 for(let i=0;i<90;i++){
  try{if((await fetch(url)).ok){ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 assert.ok(ready,'Local D&D browser harness never started');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const edition of ['2014','2024']){
  const id=randomUUID();
  const sheet={schemaVersion:1,rulesEdition:edition,layoutEdition:edition,
   identity:{name:'Синхронный герой',level:1},abilities:{
    str:{score:10},dex:{score:10},con:{score:10},int:{score:10},wis:{score:10},cha:{score:10}},
   proficiencies:{saves:{},skills:{},equipment:{}},
   combat:{hp:{current:12,maximumBase:14,temporary:0},
    ac:{baseExpression:'10+[DEX]',shieldEquipped:false,shieldBonus:2},
    speed:{walkBase:'30'},deathSaves:{successes:0,failures:0},
    conditions:[],exhaustion:0,inspiration:false},
   attacks:[],content:{blocks:{}},spellcasting:{defaultAbility:null,displayMode:'text',
    slots:{normal:{},pact:{}},spells:[]},
   inventory:{coins:{cp:0,sp:0,ep:0,gp:0,pp:0},items:[],attuned:[]},
   classes:[],features:[],resources:[],effects:[],bonuses:[],
   presentation:{hiddenBlocks:[],fontScale:1,printOptions:{}},
   imports:{origin:'manual',unmapped:{},unresolvedSpells:[]}};
  const data=JSON.stringify({dnd5eSheet:sheet}).replaceAll("'","''");
  sql("INSERT INTO public.characters(id,user_id,name,system,details) VALUES ('"+id+
   "','"+owner+"','Синхронный герой','dnd5e','"+data+"'::jsonb)");
  const A=await browser.newContext({viewport:{width:1360,height:900}});
  const B=await browser.newContext({viewport:{width:390,height:850}});
  const pageA=await A.newPage(),pageB=await B.newPage();
  try{
   for(const [page,session] of [[pageA,signed.data.session],[pageB,login.data.session]]){
    await page.addInitScript(({config})=>{
     window.__AYS_LOCAL_DND_CONFIG__=config;
    },{config:{url:vars.API_URL,anon:vars.ANON_KEY,accessToken:session.access_token,
      refreshToken:session.refresh_token,characterId:id}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__AYS_LOCAL_DND_STATUS__?.ready===true);
    assert.deepEqual(errors,[],'Browser harness error');
   }
   const label=edition==='2014'?'Имя персонажа':'Имя героя';
   await pageA.getByLabel(label).fill('Устройство А '+edition);
   await pageA.waitForFunction(()=>window.__AYS_LOCAL_DND_STATUS__?.saved===1,{timeout:15000});
   const current=await first.from('characters').select('name,revision').eq('id',id).single();
   assert.ifError(current.error);
   assert.equal(current.data.name,'Устройство А '+edition);
   assert.equal(current.data.revision,1);
   await pageB.getByLabel(label).fill('Устройство Б '+edition);
   await pageB.getByText('Ошибка сохранения').waitFor({timeout:15000});
   assert.equal(await pageB.getByLabel(label).inputValue(),'Устройство Б '+edition);
   await pageB.getByRole('button',{name:'К персонажам'}).click();
   await pageB.waitForTimeout(180);
   assert.equal(await pageB.evaluate(()=>window.__AYS_LOCAL_DND_STATUS__?.closed),0);
   const saved=await first.from('characters').select('name,revision').eq('id',id).single();
   assert.ifError(saved.error);
   assert.equal(saved.data.name,'Устройство А '+edition,
    'Stale browser must never overwrite newer remote save');
   assert.equal(saved.data.revision,1);
   const stat=await pageB.evaluate(()=>window.__AYS_LOCAL_DND_STATUS__);
   assert.ok(stat.conflicts>=1,'CAS conflict must be observable');
   console.log('PASS D&D '+edition+' two genuine browser sessions, PostgREST CAS conflict, kept draft and guarded navigation');
  }finally{await A.close();await B.close()}
 }
}finally{if(browser)await browser.close();server.kill('SIGTERM')}
