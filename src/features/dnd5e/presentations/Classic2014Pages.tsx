import type {ReactNode} from 'react';
import RichField from '../../rich-editor/RichField';
import PortraitImage from '../../portrait/PortraitImage';
import type {CropFrame} from '../../portrait/crop';
import type {AbilityId,Dnd5eSheet,Proficiency} from '../domain/model';
import {ABILITIES} from '../domain/model';
import {SKILL_ABILITIES,derivedAbility,proficiencyBonus,skillCheck,savingThrow,initiative,armorClass,effectiveVitals} from '../domain/rules';
import type {SkillId} from '../domain/rules';

export type EditDnd=(change:(draft:Dnd5eSheet)=>void)=>void;
export type Classic2014Props={
  sheet:Dnd5eSheet;name:string;onName:(value:string)=>void;
  edit:EditDnd;portraitUrl?:string;portraitFrame?:CropFrame;onEditPortrait:()=>void;
};

const abilityNames:Record<AbilityId,string>={
  str:'СИЛА',dex:'ЛОВКОСТЬ',con:'ТЕЛОСЛОЖЕНИЕ',int:'ИНТЕЛЛЕКТ',wis:'МУДРОСТЬ',cha:'ХАРИЗМА',
};
const skillNames:Record<SkillId,string>={
  acrobatics:'Акробатика',animalHandling:'Уход за животными',arcana:'Магия',athletics:'Атлетика',
  deception:'Обман',history:'История',insight:'Проницательность',intimidation:'Запугивание',
  investigation:'Анализ',medicine:'Медицина',nature:'Природа',perception:'Внимательность',
  performance:'Выступление',persuasion:'Убеждение',religion:'Религия',
  sleightOfHand:'Ловкость рук',stealth:'Скрытность',survival:'Выживание',
};
const signed=(v:number)=>v>=0?'+'+v:String(v);
function Zone({x,y,w,h,title,children,className=''}:{
  x:number;y:number;w:number;h:number;title:string;children:ReactNode;className?:string;
}){
  return <section className={'dnd14-zone '+className} aria-label={title}
    style={{left:x/210*100+'%',top:y/297*100+'%',width:w/210*100+'%',height:h/297*100+'%'}}>
    <h3 className="dnd14-zone-title">{title}</h3><div className="dnd14-zone-body">{children}</div>
  </section>;
}
function Paper({page,title,children}:{page:number;title:string;children:ReactNode}){
  return <article id={'dnd14-page-'+page} className="dnd14-paper" aria-label={'D&D 2014 — страница '+page+': '+title}>
    <div className="dnd14-page-stamp">AT YOUR SERVICE <span>· D&D 5e / 2014</span></div>
    {children}
    <div className="dnd14-page-footer">КЛАССИЧЕСКИЙ ЛИСТ · {page} / 4</div>
  </article>;
}
function TextField({label,value,onChange,wide=false}:{label:string;value:string;onChange:(value:string)=>void;wide?:boolean}){
  return <label className={'dnd14-field'+(wide?' dnd14-field-wide':'')}>
    <span>{label}</span><input aria-label={label} value={value} onChange={e=>onChange(e.target.value)} maxLength={240} autoComplete="off"/>
  </label>;
}
function NumField({label,value,onChange,min=0,max=9999}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number}){
  return <label className="dnd14-field dnd14-field-number">
    <span>{label}</span><input aria-label={label} type="number" inputMode="numeric" min={min} max={max}
      value={value} onChange={e=>onChange(Math.min(max,Math.max(min,Number(e.target.value)||0)))}/>
  </label>;
}
function RichBlock({sheet,edit,id,label,placeholder='Запиши здесь…'}:{
  sheet:Dnd5eSheet;edit:EditDnd;id:string;label:string;placeholder?:string;
}){
  return <RichField id={'dnd14-'+id.replace(/[^a-z0-9-]/gi,'-')} label={label}
    className="dnd14-rich" value={sheet.content.blocks[id]??''}
    onChange={value=>edit(d=>{d.content.blocks[id]=value;})} placeholder={placeholder}
    resourceContext={{
      ability_str:derivedAbility(sheet,'str').value,ability_dex:derivedAbility(sheet,'dex').value,
      ability_con:derivedAbility(sheet,'con').value,ability_int:derivedAbility(sheet,'int').value,
      ability_wis:derivedAbility(sheet,'wis').value,ability_cha:derivedAbility(sheet,'cha').value,
      level:sheet.identity.level,
    }}/>
}
const rankCodes:Proficiency[]=['none','proficient','expert'];
function RankField({label,value,onChange,result}:{
  label:string;value:Proficiency|undefined;onChange:(value:Proficiency)=>void;result:number;
}){
  return <label className="dnd14-rank-row" title={label}>
    <select aria-label={'Владение: '+label} value={value??'none'} onChange={e=>onChange(e.target.value as Proficiency)}>
      {rankCodes.map((rank,index)=><option value={rank} key={rank}>{['○','●','★'][index]}</option>)}
    </select><span className="dnd14-rank-result">{signed(result)}</span>
    <span className="dnd14-rank-name">{label}</span>
  </label>;
}

function PageOne({sheet,name,onName,edit}:Pick<Classic2014Props,'sheet'|'name'|'onName'|'edit'>){
  const hp=effectiveVitals(sheet);
  const setIdentity=(key:keyof Dnd5eSheet['identity'],value:string|number)=>edit(d=>{(d.identity as unknown as Record<string,unknown>)[key]=value;});
  const setHp=(key:'current'|'maximumBase'|'temporary',value:number)=>edit(d=>{d.combat.hp[key]=value;});
  return <Paper page={1} title="Основной лист">
    <Zone x={12} y={20} w={186} h={26} title="Персонаж" className="dnd14-identity-zone">
      <div className="dnd14-fields-grid dnd14-header-fields">
        <TextField label="Имя персонажа" value={name} onChange={onName}/>
        <TextField label="Класс" value={sheet.identity.className??''} onChange={v=>setIdentity('className',v)}/>
        <NumField label="Уровень" value={sheet.identity.level} min={1} max={20} onChange={v=>setIdentity('level',v)}/>
        <TextField label="Раса" value={sheet.identity.species??''} onChange={v=>setIdentity('species',v)}/>
        <TextField label="Предыстория" value={sheet.identity.background??''} onChange={v=>setIdentity('background',v)}/>
        <NumField label="Опыт" value={sheet.identity.xp??0} onChange={v=>setIdentity('xp',v)}/>
      </div>
    </Zone>
    <Zone x={12} y={50} w={43} h={108} title="Характеристики">
      <div className="dnd14-abilities">
        {ABILITIES.map(key=><label className="dnd14-ability" key={key}>
          <span>{abilityNames[key]}</span>
          <input type="number" aria-label={'Значение: '+abilityNames[key]} min={1} max={30}
            value={sheet.abilities[key].score}
            onChange={e=>edit(d=>{d.abilities[key].score=Math.min(30,Math.max(1,Number(e.target.value)||1));})}/>
          <output aria-label={'Модификатор: '+abilityNames[key]}>{signed(derivedAbility(sheet,key).value)}</output>
        </label>)}
      </div>
    </Zone>
    <Zone x={12} y={162} w={43} h={91} title="Спасброски и навыки">
      <div className="dnd14-rank-list">
        <div className="dnd14-rank-caption">Спасброски · БМ {signed(proficiencyBonus(sheet.identity.level))}</div>
        {ABILITIES.map(key=><RankField key={key} label={abilityNames[key]} value={sheet.proficiencies.saves[key]}
          result={savingThrow(sheet,key).value}
          onChange={rank=>edit(d=>{d.proficiencies.saves[key]=rank;})}/>)}
        <div className="dnd14-rank-caption">Навыки</div>
        {(Object.keys(SKILL_ABILITIES) as SkillId[]).map(key=><RankField key={key}
          label={skillNames[key]} value={sheet.proficiencies.skills[key]} result={skillCheck(sheet,key).value}
          onChange={rank=>edit(d=>{d.proficiencies.skills[key]=rank;})}/>)}
      </div>
    </Zone>
    <Zone x={12} y={257} w={43} h={25} title="Владения и языки">
      <RichBlock sheet={sheet} edit={edit} id="proficiencies" label="Владения и языки"/>
    </Zone>
    <Zone x={58} y={50} w={63} h={27} title="Бой">
      <div className="dnd14-metrics">
        <label>КЗ <output>{armorClass(sheet)}</output></label>
        <label>ИНИ <output>{signed(initiative(sheet).value)}</output></label>
        <label>СКОР <output>{hp.walkSpeed} фт</output></label>
      </div>
      <label className="dnd14-inline-check"><input type="checkbox" checked={sheet.combat.ac.shieldEquipped}
        onChange={e=>edit(d=>{d.combat.ac.shieldEquipped=e.target.checked;})}/>Щит (+{sheet.combat.ac.shieldBonus})</label>
      <label className="dnd14-inline-check"><input type="checkbox" checked={sheet.combat.inspiration}
        onChange={e=>edit(d=>{d.combat.inspiration=e.target.checked;})}/>Вдохновение</label>
    </Zone>
    <Zone x={58} y={80} w={63} h={48} title="Хиты и здоровье">
      <div className="dnd14-fields-grid dnd14-vitals">
        <NumField label="Текущие ХП" value={sheet.combat.hp.current} max={1000000} onChange={v=>setHp('current',v)}/>
        <NumField label="Максимум ХП" value={sheet.combat.hp.maximumBase} min={1} max={1000000} onChange={v=>setHp('maximumBase',v)}/>
        <NumField label="Временные ХП" value={sheet.combat.hp.temporary} max={1000000} onChange={v=>setHp('temporary',v)}/>
        <NumField label="Истощение" value={sheet.combat.exhaustion} max={6}
          onChange={v=>edit(d=>{d.combat.exhaustion=v;})}/>
      </div>
      <small>Итоговый максимум: {hp.hpMaximum}{hp.dead?' · 6 уровней истощения':''}</small>
    </Zone>
    <Zone x={58} y={131} w={63} h={30} title="Кости хитов / спасброски от смерти">
      <TextField label="Кости хитов (формула)" value={sheet.content.blocks.hitDice??''}
        onChange={v=>edit(d=>{d.content.blocks.hitDice=v;})}/>
      <div className="dnd14-death">
        {(['successes','failures'] as const).map(key=><div key={key}>
          <span>{key==='successes'?'Успехи':'Провалы'}</span>
          {[1,2,3].map(index=><label key={index} aria-label={(key==='successes'?'Успех':'Провал')+' '+index}>
            <input type="checkbox" checked={sheet.combat.deathSaves[key]>=index}
              onChange={e=>edit(d=>{d.combat.deathSaves[key]=e.target.checked?index:index-1;})}/>
          </label>)}
        </div>)}
      </div>
    </Zone>
    <Zone x={58} y={164} w={63} h={56} title="Атаки и заклинания">
      <div className="dnd14-attack-list">
        {sheet.attacks.map(attack=><div className="dnd14-attack" key={attack.id}>
          <input aria-label={'Атака: '+attack.id} placeholder="Оружие / атака" value={attack.name}
            onChange={e=>edit(d=>{const row=d.attacks.find(x=>x.id===attack.id);if(row)row.name=e.target.value;})}/>
          <select aria-label={'Характеристика атаки '+attack.id} value={attack.ability??'str'}
            onChange={e=>edit(d=>{const row=d.attacks.find(x=>x.id===attack.id);if(row)row.ability=e.target.value as AbilityId;})}>
            {ABILITIES.map(key=><option value={key} key={key}>{abilityNames[key]}</option>)}
          </select>
          <input aria-label={'Формула урона '+attack.id} placeholder="1d8+3" value={attack.damageFormula??''}
            onChange={e=>edit(d=>{const row=d.attacks.find(x=>x.id===attack.id);if(row)row.damageFormula=e.target.value;})}/>
          <button type="button" aria-label={'Удалить атаку '+attack.name}
            onClick={()=>edit(d=>{d.attacks=d.attacks.filter(x=>x.id!==attack.id);})}>×</button>
        </div>)}
        <button type="button" className="dnd14-add" onClick={()=>edit(d=>{
          if(d.attacks.length<30)d.attacks.push({id:crypto.randomUUID(),name:'',ability:'str',proficient:true,damageFormula:''});
        })}>+ Добавить атаку</button>
      </div>
    </Zone>
    <Zone x={58} y={223} w={63} h={59} title="Снаряжение и деньги">
      <div className="dnd14-coin-list">
        {(['cp','sp','ep','gp','pp'] as const).map(key=><NumField key={key} label={key.toUpperCase()}
          value={sheet.inventory.coins[key]} onChange={v=>edit(d=>{d.inventory.coins[key]=v;})}/>)}
      </div>
      <RichBlock sheet={sheet} edit={edit} id="equipment" label="Снаряжение" placeholder="Предметы, вес, количество…"/>
    </Zone>
    <Zone x={124} y={50} w={74} h={58} title="Характер и идеалы">
      <RichBlock sheet={sheet} edit={edit} id="personality" label="Черты характера и идеалы"/>
    </Zone>
    <Zone x={124} y={111} w={74} h={49} title="Привязанности и слабости">
      <RichBlock sheet={sheet} edit={edit} id="bonds" label="Привязанности и слабости"/>
    </Zone>
    <Zone x={124} y={163} w={74} h={119} title="Умения и особенности">
      <RichBlock sheet={sheet} edit={edit} id="features" label="Умения и особенности персонажа"/>
    </Zone>
  </Paper>;
}

function PageTwo({sheet,name,edit,portraitUrl,portraitFrame,onEditPortrait}:Classic2014Props){
  const setIdentity=(key:keyof Dnd5eSheet['identity'],value:string)=>edit(d=>{(d.identity as unknown as Record<string,unknown>)[key]=value;});
  return <Paper page={2} title="Биография">
    <Zone x={12} y={20} w={186} h={26} title="Биография персонажа">
      <div className="dnd14-fields-grid dnd14-bio-head">
        <span className="dnd14-bio-name">{name}</span>
        <TextField label="Возраст" value={sheet.content.blocks.age??''} onChange={v=>edit(d=>{d.content.blocks.age=v;})}/>
        <TextField label="Рост" value={sheet.content.blocks.height??''} onChange={v=>edit(d=>{d.content.blocks.height=v;})}/>
        <TextField label="Вес" value={sheet.content.blocks.weight??''} onChange={v=>edit(d=>{d.content.blocks.weight=v;})}/>
        <TextField label="Мировоззрение" value={sheet.content.blocks.alignment??''} onChange={v=>edit(d=>{d.content.blocks.alignment=v;})}/>
        <TextField label="Игрок" value={sheet.identity.player??''} onChange={v=>setIdentity('player',v)}/>
      </div>
    </Zone>
    <Zone x={12} y={50} w={72} h={88} title="Портрет" className="dnd14-portrait-zone">
      <button type="button" className="dnd14-portrait-button" onClick={onEditPortrait} aria-label="Изменить портрет D&D">
        {portraitUrl?<PortraitImage url={portraitUrl} frame={portraitFrame} alt={'Портрет '+name} className="dnd14-portrait-image"/>
          :<span className="dnd14-portrait-empty">+ Добавить портрет</span>}
      </button>
    </Zone>
    <Zone x={12} y={141} w={72} h={65} title="История персонажа">
      <RichBlock sheet={sheet} edit={edit} id="backstory" label="История персонажа"/>
    </Zone>
    <Zone x={12} y={209} w={72} h={73} title="Цели и задачи">
      <RichBlock sheet={sheet} edit={edit} id="goals" label="Цели и задачи"/>
    </Zone>
    <Zone x={87} y={50} w={111} h={67} title="Союзники и организации">
      <RichBlock sheet={sheet} edit={edit} id="allies" label="Союзники и организации"/>
    </Zone>
    <Zone x={87} y={120} w={111} h={50} title="Черты и особенности">
      <RichBlock sheet={sheet} edit={edit} id="traits" label="Черты и особенности"/>
    </Zone>
    <Zone x={87} y={173} w={111} h={52} title="Дополнительные умения">
      <RichBlock sheet={sheet} edit={edit} id="extraFeatures" label="Дополнительные умения"/>
    </Zone>
    <Zone x={87} y={228} w={111} h={54} title="Сокровища">
      <RichBlock sheet={sheet} edit={edit} id="treasure" label="Сокровища"/>
    </Zone>
  </Paper>;
}
function PageThree({sheet,edit}:Pick<Classic2014Props,'sheet'|'edit'>){
  const positions=[
    [12,22,112,82],[127,22,71,82],
    [12,107,112,82],[127,107,71,82],
    [12,192,112,90],[127,192,71,90]
  ];
  return <Paper page={3} title="Заметки">
    {positions.map(([x,y,w,h],index)=><Zone key={index} x={x} y={y} w={w} h={h} title={'Заметки '+(index+1)}>
      <RichBlock sheet={sheet} edit={edit} id={'note'+(index+1)} label={'Заметки '+(index+1)}/>
    </Zone>)}
  </Paper>;
}
function PageFour({sheet,edit}:Pick<Classic2014Props,'sheet'|'edit'>){
  const positions=[
    [0,12,50,58,65],[1,12,118,58,96],[2,12,217,58,65],
    [3,76,50,58,88],[4,76,141,58,77],[5,76,221,58,61],
    [6,140,50,58,58],[7,140,111,58,59],[8,140,173,58,57],[9,140,233,58,49]
  ];
  const stat=sheet.spellcasting.defaultAbility;
  const mod=stat?derivedAbility(sheet,stat).value:0;
  const proficiency=proficiencyBonus(sheet.identity.level);
  return <Paper page={4} title="Заклинания">
    <Zone x={12} y={20} w={186} h={26} title="Заклинания">
      <div className="dnd14-magic-head">
        <label className="dnd14-field"><span>Класс заклинателя</span><input aria-label="Класс заклинателя"
          value={sheet.content.blocks.spellClass??sheet.identity.className??''}
          onChange={e=>edit(d=>{d.content.blocks.spellClass=e.target.value;})}/></label>
        <label className="dnd14-field"><span>Характеристика</span>
          <select aria-label="Заклинательная характеристика" value={stat??''}
            onChange={e=>edit(d=>{d.spellcasting.defaultAbility=e.target.value?e.target.value as AbilityId:null;})}>
            <option value="">—</option>{ABILITIES.map(key=><option key={key} value={key}>{abilityNames[key]}</option>)}
          </select>
        </label>
        <div className="dnd14-magic-result">Сл заклинаний <output>{stat?8+proficiency+mod:'—'}</output></div>
        <div className="dnd14-magic-result">Атака заклинанием <output>{stat?signed(proficiency+mod):'—'}</output></div>
      </div>
    </Zone>
    {positions.map(([level,x,y,w,h])=>{
      const slot=sheet.spellcasting.slots.normal[String(level)]??{maximum:0,used:0};
      return <Zone key={level} x={x} y={y} w={w} h={h} title={level===0?'Заговоры':'Заклинания · '+level+' круг'}>
        {level>0&&<div className="dnd14-slots">
          <label>Всего<input type="number" aria-label={'Ячейки '+level+' круга: всего'} min={0} max={99}
            value={slot.maximum} onChange={e=>edit(d=>{
              const old=d.spellcasting.slots.normal[String(level)]??{maximum:0,used:0};
              const maximum=Math.min(99,Math.max(0,Number(e.target.value)||0));
              d.spellcasting.slots.normal[String(level)]={maximum,used:Math.min(old.used,maximum)};
            })}/></label>
          <label>Потрачено<input type="number" aria-label={'Ячейки '+level+' круга: потрачено'} min={0} max={slot.maximum}
            value={slot.used} onChange={e=>edit(d=>{
              d.spellcasting.slots.normal[String(level)]={...slot,used:Math.min(slot.maximum,Math.max(0,Number(e.target.value)||0))};
            })}/></label>
        </div>}
        <RichBlock sheet={sheet} edit={edit} id={'spellLevel'+level} label={'Заклинания '+level+' круга'}
          placeholder="Названия, подготовка, описания…"/>
      </Zone>;
    })}
  </Paper>;
}

export default function Classic2014Pages(props:Classic2014Props){
  return <div className="dnd14-paper-stack" data-dnd-edition="2014">
    <PageOne sheet={props.sheet} name={props.name} onName={props.onName} edit={props.edit}/>
    <PageTwo {...props}/>
    <PageThree sheet={props.sheet} edit={props.edit}/>
    <PageFour sheet={props.sheet} edit={props.edit}/>
  </div>;
}
