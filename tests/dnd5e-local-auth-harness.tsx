/** Disposable two-browser acceptance of the actual D&D editor and PostgREST saves.
 * This harness intentionally uses a fixture-specific revision CAS. It does
 * not claim a full production schema/repository or migration test.
 */
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import Classic2014Sheet from '../src/features/dnd5e/presentations/Classic2014Sheet';
import type {Character,CharacterDetails} from '../src/lib/models';
import '../src/styles.css';
type LocalConfig={url:string;anon:string;accessToken:string;refreshToken:string;characterId:string};
declare global {interface Window {
  __AYS_LOCAL_DND_CONFIG__?:LocalConfig;
  __AYS_LOCAL_DND_STATUS__?:{ready:boolean;attempts:number;saved:number;conflicts:number;closed:number;};
}}
const conf=window.__AYS_LOCAL_DND_CONFIG__;
if(!conf||!/^http:\/\/(localhost|127\.0\.0\.1):54321\/?$/.test(conf.url))
 throw Error('Local-only Supabase configuration is required');
const db=createClient(conf.url,conf.anon,{auth:{persistSession:false,autoRefreshToken:false}});
const session=await db.auth.setSession({access_token:conf.accessToken,refresh_token:conf.refreshToken});
if(session.error||!session.data.user)throw Error('Local Auth session missing');
const owner=session.data.user.id;
const result=await db.from('characters').select('id,user_id,name,system,details,revision')
 .eq('id',conf.characterId).single();
if(result.error||!result.data||result.data.user_id!==owner||result.data.system!=='dnd5e')
 throw Error('Local fixture must be owned by genuine signed-in user');
const stored=result.data;
const character:Character={id:stored.id,user_id:stored.user_id,name:stored.name,
 system:'dnd5e',details:stored.details as CharacterDetails,sort_order:1,
 created_at:'',updated_at:'',portrait_card_path:null,portrait_sheet_path:null,
 portrait_source_path:null,portrait_crops:null};
let revision=stored.revision as number;
const status={ready:false,attempts:0,saved:0,conflicts:0,closed:0};
window.__AYS_LOCAL_DND_STATUS__=status;
createRoot(document.getElementById('root')!).render(
 <Classic2014Sheet character={character}
  onSave={async(_id,name,details)=>{
    status.attempts++;
    const response=await db.from('characters').update({name,details,revision:revision+1})
      .eq('id',stored.id).eq('revision',revision).select('revision');
    if(response.error)throw Error('Ошибка сохранения: '+response.error.message);
    if(response.data?.length!==1){status.conflicts++;throw Error('Конфликт: лист изменён другим устройством');}
    revision=response.data[0].revision as number;
    status.saved++;
    return true;
  }}
  onClose={()=>{status.closed++;}}
  onEditPortrait={()=>{}}
 />
);
status.ready=true;
