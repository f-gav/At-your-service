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
const alternative=params.get('variant')==='alternative';
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
    ? {pathfinderSheet:{
      pf2e_notes_enabled:notes?'true':'false',
      ...(alternative?{
        pf2e_layout:'alternative',
        name:'Элирэн Лунный Взор',player:'Игрок',level:'7',experience:'1200',
        ancestry_features:'ays:rich:v1:<div><b>Эльф-провидец</b></div><div>Обнаружение магии</div>',
        ancestry:'Эльф',heritage:'Провидец',background:'Искатель знаний',character_class:'Волшебник',
        hero_1:true,hero_2:true,ability_str:'0',ability_dex:'+3',ability_con:'+1',
        ability_int:'+4',ability_wis:'+2',ability_cha:'-1',
        wealth_pp:'12',wealth_gp:'23',wealth_sp:'34',wealth_cp:'45',action_1_page:'1',
        hp_current:'55',hp_max:'67',dying:'2',shield_hp:'18',
        skill_acrobatics_total:'+13',skill_arcana_total:'+17',weapon_1_name:'Ритуальный кинжал',
        weapon_1_attack:'+14',weapon_1_damage:'1d4+2',weapon_1_traits:'Лёгкий, ловкое',
        feat_level_2:'Обнаружение магии',class_level_2:'Классовая способность',
        inventory_held:'Свёрток с рунами\nКнига заклинаний\nПосох',
        campaign_notes:'Исследование руин на севере.',
        appearance:'Серебряные волосы, чёрный плащ.',
        attitude:'Любознательный и осторожный',
        tradition_arcane:true,prepared:true,spell_slots_1:'4',spell_slots_2:'3',
        spell_slots_3:'2',spell_dc:'25',spell_attack:'+15',
        pf_spell_display_mode:params.get('spells')==='library'?'library':'text',
        cantrip_names:'Свет\nУказание',spellbook_left_names:'Магический снаряд\nНевидимость'
      }:{}),
    }}
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
