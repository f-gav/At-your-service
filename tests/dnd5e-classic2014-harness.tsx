import {createRoot} from 'react-dom/client';
import Classic2014Sheet from '../src/features/dnd5e/presentations/Classic2014Sheet';
import {newDndSheet} from '../src/features/dnd5e/domain/model';
import {createDndPdfStage} from '../src/features/dnd5e/infra/dnd-pdf';
import type {Character,CharacterDetails} from '../src/lib/models';
import '../src/styles.css';

const startEdition=new URLSearchParams(window.location.search).get('edition')==='2024'?'2024':'2014';
const sheet=newDndSheet('Аврора',startEdition);
sheet.identity.className='Следопыт';
sheet.identity.level=3;
sheet.combat.hp.current=17;
sheet.combat.hp.maximumBase=21;
sheet.abilities.dex.score=14;
sheet.content.blocks.note2='Сохранённый второй блок';
if(new URLSearchParams(window.location.search).get('long')==='1'){
  sheet.content.blocks.note1=('Полное описание, которое обязано сохраниться в PDF. '+ 
    'Вероятность, история, навыки и заклинания. \n').repeat(210);
  sheet.content.blocks.spellLevel1='Отдельная строка магии. '.repeat(185);
}
const character:Character={
  id:'dnd-browser-test',user_id:'dnd-test-user',system:'dnd5e',name:'Аврора',
  details:{dnd5eSheet:sheet,notes:'Общий дополнительный текст'},
  sort_order:1,created_at:'',updated_at:'',portrait_card_path:null,portrait_sheet_path:null,
  portrait_source_path:null,portrait_crops:null,
};
const harness={saves:[] as {name:string;details:CharacterDetails}[],portraitOpens:0,closed:0,
  rejectSaves:new URLSearchParams(window.location.search).get('conflict')==='1',
  auditPdfStage:()=>{
    const root=document.querySelector<HTMLElement>('main[data-dnd-classic-version]');
    if(!root)throw Error('D&D paper root not found');
    const {stage,pages,supplementPages}=createDndPdfStage(root,sheet);
    try{
      return {totalPages:pages.length,supplementPages,
        textPages:Array.from(stage.querySelectorAll<HTMLElement>('.dnd-pdf-supplement')).map(page=>{
          const body=page.querySelector<HTMLElement>('.dnd-pdf-supplement-body')!;
          return {clientHeight:body.clientHeight,scrollHeight:body.scrollHeight,
            text:body.textContent?.length??0};
        })};
    }finally{stage.remove();}
  }};
(window as unknown as {__AYS_DND_2014_TEST__:typeof harness}).__AYS_DND_2014_TEST__=harness;
createRoot(document.getElementById('root')!).render(
  <Classic2014Sheet character={character}
    onSave={async(_id,name,details)=>{
      if(harness.rejectSaves)throw Error('Конфликт сохранения: другое устройство изменило лист');
      harness.saves.push({name,details});return true;
    }}
    onClose={()=>{harness.closed++;}}
    onEditPortrait={()=>{harness.portraitOpens++;}}
  />
);
