/** Original classic D&D 2024 presentation: four fixed A4 pages.
 * Uses the same sheet data as the 2014 layout, never migrates/rekeys content.
 * Paper geometry is derived from Stage 2's independent 2024 wireframes.
 */
import type {AbilityId,Dnd5eSheet} from '../domain/model';
import {ABILITIES} from '../domain/model';
import {attackCheck,armorClass,derivedAbility,effectiveVitals,exhaustionEffects,initiative,proficiencyBonus,savingThrow,skillCheck} from '../domain/rules';
import type {SkillId} from '../domain/rules';
import PortraitImage from '../../portrait/PortraitImage';
import {
  Paper,Zone,TextField,NumField,RichBlock,RankField,
  abilityNames,skillNames,signed,
} from './Classic2014Pages';
import type {Classic2014Props,EditDnd} from './Classic2014Pages';
import './Classic2024.css';

type P=Classic2014Props;
const groupedSkills:Record<AbilityId,SkillId[]>={
  str:['athletics'],
  dex:['acrobatics','sleightOfHand','stealth'],
  con:[],
  int:['arcana','history','investigation','nature','religion'],
  wis:['animalHandling','insight','medicine','perception','survival'],
  cha:['deception','intimidation','performance','persuasion'],
};
const statPosition:Record<AbilityId,[number,number]>={
  str:[12,52],dex:[54,52],con:[12,116],int:[54,116],wis:[12,180],cha:[54,180],
};
const editIdentity=(edit:EditDnd,key:keyof Dnd5eSheet['identity'],value:string|number)=>
  edit(d=>{(d.identity as unknown as Record<string,unknown>)[key]=value;});
const setHp=(edit:EditDnd,key:'current'|'maximumBase'|'temporary',v:number)=>
  edit(d=>{d.combat.hp[key]=v;});
function Heading({sheet,name,onName,edit}:Pick<P,'sheet'|'name'|'onName'|'edit'>){
  return <div className="dnd24-header-grid">
    <TextField label="Имя героя" value={name} onChange={onName}/>
    <TextField label="Класс" value={sheet.identity.className??''} onChange={v=>editIdentity(edit,'className',v)}/>
    <NumField label="Уровень" value={sheet.identity.level} min={1} max={20}
      onChange={v=>editIdentity(edit,'level',v)}/>
    <TextField label="Вид" value={sheet.identity.species??''} onChange={v=>editIdentity(edit,'species',v)}/>
    <TextField label="Предыстория" value={sheet.identity.background??''}
      onChange={v=>editIdentity(edit,'background',v)}/>
    <NumField label="Опыт" value={sheet.identity.xp??0} max={99999999}
      onChange={v=>editIdentity(edit,'xp',v)}/>
  </div>;
}
function AbilityGroup({sheet,edit,ability}:Pick<P,'sheet'|'edit'>&{ability:AbilityId}){
  const score=sheet.abilities[ability].score;
  return <div className="dnd24-stat-group" data-ability={ability}>
    <label className="dnd24-stat-score">
      <span>{abilityNames[ability]}</span>
      <input aria-label={'2024 значение '+abilityNames[ability]} type="number" min={1} max={30}
        value={score} onChange={e=>edit(d=>{
          d.abilities[ability].score=Math.min(30,Math.max(1,Number(e.target.value)||1));
        })}/>
      <output>{signed(derivedAbility(sheet,ability).value)}</output>
    </label>
    <RankField label={'Спасбросок '+abilityNames[ability]}
      value={sheet.proficiencies.saves[ability]} result={savingThrow(sheet,ability).value}
      onChange={rank=>edit(d=>{d.proficiencies.saves[ability]=rank;})}/>
    {groupedSkills[ability].map(skill=><RankField key={skill} label={skillNames[skill]}
      value={sheet.proficiencies.skills[skill]} result={skillCheck(sheet,skill).value}
      onChange={rank=>edit(d=>{d.proficiencies.skills[skill]=rank;})}/>)}
  </div>;
}
function MainPage({sheet,name,onName,edit}:Pick<P,'sheet'|'name'|'onName'|'edit'>){
  const hp=effectiveVitals(sheet),effect=exhaustionEffects(sheet);
  const conditions=sheet.combat.conditions.join(', ');
  return <Paper page={1} title="Основной лист" edition="2024">
    <Zone x={12} y={20} w={186} h={28} title="Персонаж" className="dnd14-identity-zone">
      <Heading sheet={sheet} name={name} onName={onName} edit={edit}/>
    </Zone>
    {ABILITIES.map(key=>{
      const [x,y]=statPosition[key];
      return <Zone key={key} x={x} y={y} w={39} h={61} title={abilityNames[key]} className="dnd24-ability-zone">
        <AbilityGroup sheet={sheet} edit={edit} ability={key}/>
      </Zone>;
    })}
    <Zone x={12} y={244} w={81} h={18} title="Истощение и героическое вдохновение">
      <div className="dnd24-inspiration">
        <NumField label="Истощение" value={sheet.combat.exhaustion} max={6}
          onChange={v=>edit(d=>{d.combat.exhaustion=v;})}/>
        <label><input type="checkbox" aria-label="Героическое вдохновение"
          checked={sheet.combat.inspiration} onChange={e=>edit(d=>{d.combat.inspiration=e.target.checked;})}/>
          Вдохновение</label>
        <small>−{Math.abs(effect.d20Penalty)} к к20</small>
      </div>
    </Zone>
    <Zone x={12} y={265} w={81} h={17} title="Владения и языки">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="proficiencies" label="Владения и языки"/>
    </Zone>
    <Zone x={97} y={52} w={101} h={44} title="КЗ · ХП · кости хитов · смерть">
      <div className="dnd24-combat-summary">
        <div className="dnd24-combat-ac">
          <strong>КЗ <output>{armorClass(sheet)}</output></strong>
          <label>Основа КЗ<select aria-label="2024 основа КЗ" value={sheet.combat.ac.baseExpression}
            onChange={e=>edit(d=>{d.combat.ac.baseExpression=e.target.value;})}>
            <option value="10+[DEX]">10 + ЛОВ</option>
            {Array.from({length:11},(_,n)=>String(n+10)).map(v=><option key={v} value={v}>{v}</option>)}
          </select></label>
          <label><input type="checkbox" checked={sheet.combat.ac.shieldEquipped}
            aria-label="2024 надеть щит" onChange={e=>edit(d=>{d.combat.ac.shieldEquipped=e.target.checked;})}/>Щит</label>
        </div>
        <div className="dnd24-hp-grid">
          <NumField label="ХП" value={sheet.combat.hp.current} max={1000000}
            onChange={v=>setHp(edit,'current',v)}/>
          <NumField label="Макс. ХП" value={sheet.combat.hp.maximumBase} min={1} max={1000000}
            onChange={v=>setHp(edit,'maximumBase',v)}/>
          <NumField label="Врем. ХП" value={sheet.combat.hp.temporary} max={1000000}
            onChange={v=>setHp(edit,'temporary',v)}/>
        </div>
      </div>
      <div className="dnd24-combat-bottom">
        <TextField label="Кости хитов" value={sheet.content.blocks.hitDice??''}
          onChange={v=>edit(d=>{d.content.blocks.hitDice=v;})}/>
        {(['successes','failures'] as const).map(kind=><div key={kind} className="dnd24-death">
          <span>{kind==='successes'?'Успехи':'Провалы'}</span>
          {[1,2,3].map(index=><input key={index} type="checkbox"
            aria-label={'2024 '+(kind==='successes'?'успех':'провал')+' смерти '+index}
            checked={sheet.combat.deathSaves[kind]>=index}
            onChange={e=>edit(d=>{d.combat.deathSaves[kind]=e.target.checked?index:index-1;})}/>)}
        </div>)}
      </div>
    </Zone>
    <Zone x={97} y={99} w={101} h={35} title="Инициатива · скорость · состояния">
      <div className="dnd24-quick-metrics">
        <label>Инициатива<output>{signed(initiative(sheet).value)}</output></label>
        <label>Скорость<output>{hp.walkSpeed} фт</output></label>
        <NumField label="Базовая скорость" value={Number(sheet.combat.speed.walkBase)||0} max={1000}
          onChange={v=>edit(d=>{d.combat.speed.walkBase=String(v);})}/>
      </div>
      <TextField label="Состояния (через запятую)" value={conditions} onChange={value=>edit(d=>{
        d.combat.conditions=[...new Set(value.split(',').map(s=>s.trim()).filter(Boolean))].slice(0,20);
      })}/>
    </Zone>
    <Zone x={97} y={137} w={101} h={57} title="Оружие и боевые заговоры">
      <div className="dnd24-attack-list">
        {sheet.attacks.map(attack=><div className="dnd24-attack-line" key={attack.id}>
          <input aria-label={'2024 атака '+attack.id} placeholder="Оружие / заговор"
            value={attack.name} onChange={e=>edit(d=>{
              const row=d.attacks.find(a=>a.id===attack.id);if(row)row.name=e.target.value;
            })}/>
          <select aria-label={'2024 характеристика атаки '+attack.id} value={attack.ability??'str'}
            onChange={e=>edit(d=>{const row=d.attacks.find(a=>a.id===attack.id);if(row)row.ability=e.target.value as AbilityId;})}>
            {ABILITIES.map(a=><option key={a} value={a}>{abilityNames[a]}</option>)}
          </select>
          <output aria-label={'2024 бонус атаки '+attack.id}>
            {signed(attackCheck(sheet,attack.ability??'str',attack.proficient!==false).value)}
          </output>
          <input aria-label={'2024 урон '+attack.id} placeholder="1d8+3"
            value={attack.damageFormula??''} onChange={e=>edit(d=>{
              const row=d.attacks.find(a=>a.id===attack.id);if(row)row.damageFormula=e.target.value;
            })}/>
          <input type="checkbox" title="Владение" aria-label={'2024 владение атакой '+attack.id}
            checked={attack.proficient!==false} onChange={e=>edit(d=>{
              const row=d.attacks.find(a=>a.id===attack.id);if(row)row.proficient=e.target.checked;
            })}/>
          <button type="button" aria-label={'Удалить атаку '+attack.name}
            onClick={()=>edit(d=>{d.attacks=d.attacks.filter(a=>a.id!==attack.id);})}>×</button>
        </div>)}
        <button type="button" className="dnd14-add" onClick={()=>edit(d=>{
          if(d.attacks.length<30)d.attacks.push({id:crypto.randomUUID(),name:'',ability:'str',proficient:true,damageFormula:''});
        })}>+ Добавить атаку</button>
      </div>
    </Zone>
    <Zone x={97} y={197} w={101} h={85} title="Умения и способности">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="features" label="Умения и способности"/>
    </Zone>
  </Paper>;
}
function StoryPage({sheet,name,edit,portraitUrl,portraitFrame,onEditPortrait}:P){
  return <Paper page={2} title="История и способности" edition="2024">
    <Zone x={12} y={20} w={80} h={117} title="Портрет" className="dnd14-portrait-zone">
      <button type="button" aria-label="Изменить портрет D&D 2024"
        className="dnd14-portrait-button" onClick={onEditPortrait}>
        {portraitUrl?<PortraitImage url={portraitUrl} frame={portraitFrame}
          alt={'Портрет '+name} className="dnd14-portrait-image"/>
          :<span className="dnd14-portrait-empty">+ Добавить портрет</span>}
      </button>
    </Zone>
    <Zone x={12} y={140} w={80} h={142} title="Цели и задачи">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="goals" label="Цели и задачи"/>
    </Zone>
    <Zone x={95} y={20} w={103} h={95} title="Союзники и организации">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="allies" label="Союзники и организации"/>
    </Zone>
    <Zone x={95} y={118} w={103} h={97} title="Дополнительные способности">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="extraFeatures" label="Дополнительные способности"/>
    </Zone>
    <Zone x={95} y={218} w={103} h={64} title="Сокровища">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="treasure" label="Сокровища"/>
    </Zone>
  </Paper>;
}
function NotesPage({sheet,edit}:Pick<P,'sheet'|'edit'>){
  const rows:[[number,number,number,number],[number,number,number,number]][]=[
    [[12,20,118,82],[133,20,65,82]],
    [[12,105,118,82],[133,105,65,82]],
    [[12,190,118,92],[133,190,65,92]],
  ];
  return <Paper page={3} title="Заметки" edition="2024">
    {rows.flat().map(([x,y,w,h],index)=><Zone key={index} x={x} y={y} w={w} h={h}
      title={'Заметки '+(index+1)}>
      <RichBlock edition="2024" sheet={sheet} edit={edit}
        id={'note'+(index+1)} label={'Заметки '+(index+1)}/>
    </Zone>)}
  </Paper>;
}
function SpellLevel({sheet,edit,level}:Pick<P,'sheet'|'edit'>&{level:number}){
  return <div className="dnd24-spell-level">
    <div className="dnd24-spell-level-title">
      <strong>{level===0?'Заговоры':level+' круг'}</strong>
      {level>0&&<span>{(sheet.spellcasting.slots.normal[String(level)]?.maximum??0)-
        (sheet.spellcasting.slots.normal[String(level)]?.used??0)} осталось</span>}
    </div>
    <RichBlock edition="2024" sheet={sheet} edit={edit} id={'spellLevel'+level}
      label={'Заклинания '+level+' круга'} placeholder="Название · подготовка · время · дистанция…"/>
  </div>;
}
function MagicPage({sheet,edit}:Pick<P,'sheet'|'edit'>){
  const castingAbility=sheet.spellcasting.defaultAbility;
  const spellModifier=castingAbility?derivedAbility(sheet,castingAbility).value:0;
  const skillBonus=proficiencyBonus(sheet.identity.level);
  return <Paper page={4} title="Магия и снаряжение" edition="2024">
    <Zone x={12} y={20} w={130} h={37} title="Заклинательная характеристика">
      <div className="dnd24-casting-header">
        <TextField label="Класс заклинателя" value={sheet.content.blocks.spellClass??sheet.identity.className??''}
          onChange={v=>edit(d=>{d.content.blocks.spellClass=v;})}/>
        <label className="dnd14-field"><span>Характеристика</span>
          <select aria-label="2024 заклинательная характеристика" value={castingAbility??''}
            onChange={e=>edit(d=>{d.spellcasting.defaultAbility=e.target.value?e.target.value as AbilityId:null;})}>
            <option value="">—</option>{ABILITIES.map(ability=><option key={ability} value={ability}>{abilityNames[ability]}</option>)}
          </select>
        </label>
        <label>Сл спасброска<output>{castingAbility?8+skillBonus+spellModifier:'—'}</output></label>
        <label>Атака заклинанием<output>{castingAbility?signed(skillBonus+spellModifier):'—'}</output></label>
      </div>
    </Zone>
    <Zone x={12} y={60} w={130} h={41} title="Ячейки заклинаний 1–9">
      <div className="dnd24-slot-grid">
        {Array.from({length:9},(_,index)=>index+1).map(level=>{
          const key=String(level),slot=sheet.spellcasting.slots.normal[key]??{maximum:0,used:0};
          return <div className="dnd24-slot" key={level}>
            <strong>{level}</strong>
            <input aria-label={'2024 ячейки '+level+' всего'} type="number" min={0} max={99}
              value={slot.maximum} onChange={e=>edit(d=>{
                const n=Math.min(99,Math.max(0,Number(e.target.value)||0));
                d.spellcasting.slots.normal[key]={maximum:n,used:Math.min(slot.used,n)};
              })}/>
            <span>/</span>
            <input aria-label={'2024 ячейки '+level+' потрачено'} type="number" min={0} max={slot.maximum}
              value={slot.used} onChange={e=>edit(d=>{
                d.spellcasting.slots.normal[key]={maximum:slot.maximum,
                  used:Math.min(slot.maximum,Math.max(0,Number(e.target.value)||0))};
              })}/>
          </div>;
        })}
      </div>
    </Zone>
    <Zone x={12} y={104} w={130} h={178} title="Заговоры и подготовленные заклинания">
      <div className="dnd24-spell-grid">
        {Array.from({length:10},(_,level)=><SpellLevel key={level}
          sheet={sheet} edit={edit} level={level}/>)}
      </div>
    </Zone>
    <Zone x={145} y={20} w={53} h={61} title="Внешность">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="appearance" label="Внешность"/>
    </Zone>
    <Zone x={145} y={84} w={53} h={66} title="Предыстория и качества">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="personality" label="Личные качества"/>
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="bonds" label="Идеалы, привязанности и слабости"/>
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="backstory" label="История"/>
    </Zone>
    <Zone x={145} y={153} w={53} h={96} title="Снаряжение">
      <RichBlock edition="2024" sheet={sheet} edit={edit} id="equipment" label="Снаряжение"/>
    </Zone>
    <Zone x={145} y={252} w={53} h={30} title="Настройка и монеты">
      <div className="dnd24-coin-grid">
        {(['cp','sp','ep','gp','pp'] as const).map(key=><NumField key={key}
          label={key.toUpperCase()} value={sheet.inventory.coins[key]}
          onChange={v=>edit(d=>{d.inventory.coins[key]=v;})}/>)}
      </div>
      <RichBlock edition="2024" sheet={sheet} edit={edit}
        id="attunement" label="Настроенные предметы" placeholder="До трёх предметов…"/>
    </Zone>
  </Paper>;
}
export default function Classic2024Pages(props:P){
  return <div className="dnd14-paper-stack dnd24-paper-stack" data-dnd-edition="2024">
    <MainPage sheet={props.sheet} name={props.name} onName={props.onName} edit={props.edit}/>
    <StoryPage {...props}/>
    <NotesPage sheet={props.sheet} edit={props.edit}/>
    <MagicPage sheet={props.sheet} edit={props.edit}/>
  </div>;
}
