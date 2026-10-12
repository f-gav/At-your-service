import React from 'react';
import {createRoot} from 'react-dom/client';
import '../src/styles.css';
import PathfinderSheet from '../src/features/pathfinder/PathfinderSheet';
import ProjectMoonSheet from '../src/features/project-moon/ProjectMoonSheet';
import {emptyMoonSheet,addMoonWeapon,addMoonSkill} from '../src/features/project-moon/model';
import {exportRenderedSheetPdf} from '../src/lib/sheet-pdf';
import type {Character} from '../src/lib/models';

const params=new URLSearchParams(location.search);
const system=params.get('system')==='pf2e'?'pf2e':'prmoon';
const notes=params.get('notes')==='1';
const extras=params.get('extras')==='1';
const moon=emptyMoonSheet();
if(extras){
  for(let i=0;i<3;i++)moon.weapons.push({
    id:'weapon-extra-'+i,name:'Дополнительное оружие '+(i+1),dice:'2d6',
    bonus:'+2',description:'Урон и описание оружия',rank:'1',ep:'0',
  });
  for(let i=0;i<4;i++)moon.skills.push({
    id:'skill-extra-'+i,title:'Боевой приём '+(i+7),
    rank:'1',light:'2',ep:'0',body:'Пример описания боевого приёма',
  });
}
const character:Character={
  id:'pdf-test-character',user_id:'pdf-test-user',system,
  name:'PDF тест — персонаж',
  details:system==='pf2e'
    ? {pathfinderSheet:{pf2e_notes_enabled:notes?'true':'false'}}
    : {projectMoonSheet:moon},
  sort_order:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
  portrait_card_path:null,portrait_sheet_path:null,portrait_source_path:null,portrait_crops:null,
};
const noop=()=>{};
createRoot(document.getElementById('root')!).render(
  system==='pf2e'
  ? <PathfinderSheet character={character} onSave={async()=>true} onClose={noop} onEditPortrait={noop}/>
  : <ProjectMoonSheet character={character} onSave={async()=>true} onClose={noop} onEditPortrait={noop} previewMode/>
);
document.getElementById('generate-test-pdf')!.addEventListener('click',()=>{
  const selector=system==='pf2e'?'.pf-editor':'.moon-editor';
  const root=document.querySelector<HTMLElement>(selector);
  if(!root)throw Error('Sheet did not mount');
  void exportRenderedSheetPdf(root,character.name,system).catch(error=>{
    document.body.dataset.pdfError=String(error);
    console.error(error);
  });
});
