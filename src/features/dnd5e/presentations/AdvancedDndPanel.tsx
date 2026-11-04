/** Advanced mechanics live outside printable A4 pages: both paper editions
 * share exactly this editor, source data, CAS autosave and formula validation.
 */
import {useState} from 'react';
import RichField from '../../rich-editor/RichField';
import {DICE_ERROR_EVENT,DICE_ROLL_EVENT} from '../../../lib/dice-engine';
import type {Dnd5eSheet,DndBonus,DndClassLevel,DndResource} from '../domain/model';
import {dndFormulaVariables,rollDndLssFormula,evaluateDndNumericFormula} from '../domain/lss-formulas';
import {activeDndBonuses} from '../domain/bonuses';
import {advanceDndEffect,applySuggestedSlots,assignDndClasses,castDndSpell,
  dndConditionModifiers,restoreDndRest,suggestDndSpellSlots,updateDndResource} from '../domain/advanced';
import type {EditDnd} from './Classic2014Pages';
import './AdvancedDndPanel.css';

type Props={sheet:Dnd5eSheet;edit:EditDnd};
type Tab='spells'|'classes'|'bonuses'|'effects'|'resources'|'features';
const tabs:{id:Tab;name:string}[]=[
  {id:'spells',name:'Гримуар'},
  {id:'classes',name:'Мультикласс'},
  {id:'bonuses',name:'Бонусы'},
  {id:'effects',name:'Эффекты'},
  {id:'resources',name:'Ресурсы'},
  {id:'features',name:'Способности'},
];
const bonusTargets=['ac','initiative','hp.max','speed.walk',
  'ability.str','ability.dex','ability.con','ability.int','ability.wis','ability.cha',
  'skill.perception','skill.stealth','save.dex','attack'];
const casterLabels:{value:DndClassLevel['caster'];label:string}[]=[
  {value:'none',label:'Нет заклинаний'},{value:'full',label:'Полный заклинатель'},
  {value:'half',label:'Половинный'},{value:'third',label:'Третичный'},
  {value:'pact',label:'Договор колдуна'},
];
const uid=()=>crypto.randomUUID();
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,Math.trunc(v||0)));
function emitRoll(fn:()=>ReturnType<typeof rollDndLssFormula>):void{
  try{window.dispatchEvent(new CustomEvent(DICE_ROLL_EVENT,{detail:fn()}));}
  catch(err){window.dispatchEvent(new CustomEvent(DICE_ERROR_EVENT,{
    detail:err instanceof Error?err.message:'Ошибка формулы',
  }));}
}
function RichDescription({id,label,value,onChange,sheet}:{id:string;label:string;value:string;
  onChange:(s:string)=>void;sheet:Dnd5eSheet}){
  const vars=dndFormulaVariables(sheet);
  return <RichField id={'dndadvanced-'+id} label={label} value={value}
    placeholder="Описание, формулы, заметки…" className="dndadvanced-rich"
    resourceContext={{ability_str:vars.STR,ability_dex:vars.DEX,ability_con:vars.CON,
      ability_int:vars.INT,ability_wis:vars.WIS,ability_cha:vars.CHA,
      level:vars.LVL,proficiency:vars.PROF,half_proficiency:vars.HALF_PROF}}
    onChange={onChange}/>;
}
function NumericInput({label,value,onChange,min=0,max=9999}:{label:string;value:number;
  onChange:(v:number)=>void;min?:number;max?:number}){
  return <label className="dndadvanced-input"><span>{label}</span>
    <input aria-label={label} type="number" min={min} max={max}
      value={value} onChange={e=>onChange(clamp(Number(e.target.value),min,max))}/>
  </label>;
}
function BonusFormulaEditor({bonus,sheet,onCommit}:{bonus:DndBonus;sheet:Dnd5eSheet;onCommit:(value:string)=>void}){
  const [draft,setDraft]=useState(bonus.formula??String(bonus.value??0));
  const [error,setError]=useState('');
  const commit=()=>{
    try {
      if(!draft.trim())throw Error('Введите числовую формулу');
      evaluateDndNumericFormula(draft,dndFormulaVariables(sheet));
      onCommit(draft.trim());
      setError('');
    }catch(err){setError(err instanceof Error?err.message:'Недопустимая формула');}
  };
  return <label>Значение / формула
    <input aria-label={'Формула бонуса '+bonus.id} maxLength={1000} value={draft}
      onChange={e=>setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
    {error&&<small role="alert" className="dndadvanced-error">{error}</small>}
  </label>;
}
function SpellsTab({sheet,edit}:Props){
  const [levelFilter,setLevelFilter]=useState('all');
  const [pool,setPool]=useState<'normal'|'pact'>('normal');
  const [castLevel,setCastLevel]=useState(1);
  const [error,setError]=useState('');
  const spells=sheet.spellcasting.spells.filter(s=>levelFilter==='all'||s.level===Number(levelFilter));
  const prepared=sheet.spellcasting.spells.filter(s=>s.prepared).length;
  const known=sheet.spellcasting.spells.filter(s=>s.known).length;
  const book=sheet.spellcasting.spells.filter(s=>s.inBook).length;
  const cast=(id:string)=>{
    try {
      const result=castDndSpell(sheet,id,pool,castLevel);
      edit(d=>{d.spellcasting=result.spellcasting;});
      setError('');
    }catch(err){setError(err instanceof Error?err.message:'Не удалось потратить ячейку');}
  };
  return <section className="dndadvanced-tab" aria-label="Гримуар D&D">
    <header className="dndadvanced-row">
      <strong>Заклинания · {sheet.rulesEdition}</strong>
      <span>Известно: {known} · Подготовлено: {prepared} · Книга: {book}</span>
      <button type="button" onClick={()=>edit(d=>{
        if(d.spellcasting.spells.length<300)d.spellcasting.spells.push({
          id:uid(),name:'Новое заклинание',level:1,source:'homebrew',
          known:false,prepared:false,inBook:true,granted:false,slotless:false,description:'',
        });
      })}>+ Заклинание</button>
    </header>
    <p className="dndadvanced-help">Подготовленные, известные, дарованные и записанные в книгу заклинания учитываются отдельно. Ограничение числа подготовленных зависит от класса и пока устанавливается игроком. Круг доступной ячейки выбирается явно.</p>
    <div className="dndadvanced-row">
      <label>Круг <select aria-label="Фильтр круга заклинаний" value={levelFilter}
        onChange={e=>setLevelFilter(e.target.value)}>
        <option value="all">Все</option>
        {Array.from({length:10},(_,i)=><option key={i} value={i}>{i||'Заговоры'}</option>)}
      </select></label>
      <label>Ячейки <select aria-label="Источник ячеек для заклинания" value={pool}
        onChange={e=>setPool(e.target.value as 'normal'|'pact')}>
        <option value="normal">Обычные</option><option value="pact">Договор</option>
      </select></label>
      <NumericInput label="Круг ячейки для сотворения" value={castLevel} min={1} max={9}
        onChange={setCastLevel}/>
    </div>
    {error&&<p role="alert" className="dndadvanced-error">{error}</p>}
    <div className="dndadvanced-collection">
      {spells.map(spell=><article className="dndadvanced-entry" key={spell.id}>
        <div className="dndadvanced-row">
          <label>Название <input aria-label={'Название заклинания '+spell.id} maxLength={160}
            value={spell.name} onChange={e=>edit(d=>{
              const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.name=e.target.value;
            })}/></label>
          <NumericInput label={'Круг заклинания '+spell.id} min={0} max={9} value={spell.level}
            onChange={v=>edit(d=>{
              const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.level=v;
            })}/>
          <label>Источник <select aria-label={'Источник заклинания '+spell.id} value={spell.source}
            onChange={e=>edit(d=>{
              const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.source=e.target.value;
            })}>
            <option value="homebrew">Своё</option>
            <option value="srd-5.1">SRD 5.1</option>
            <option value="srd-5.2.1">SRD 5.2.1</option>
            <option value="imported">Импортировано</option>
          </select></label>
          <button type="button" aria-label={'Удалить заклинание '+spell.id}
            onClick={()=>edit(d=>{d.spellcasting.spells=d.spellcasting.spells.filter(x=>x.id!==spell.id);})}>Удалить</button>
        </div>
        <div className="dndadvanced-row dndadvanced-flags">
          {([
            ['known','Известно'],['prepared','Подготовлено'],['inBook','В книге'],
            ['granted','Даровано'],['slotless','Без ячейки'],
          ] as const).map(([key,label])=><label key={key}>
            <input type="checkbox" aria-label={label+' '+spell.id} checked={!!spell[key]}
              onChange={e=>edit(d=>{
                const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row[key]=e.target.checked;
              })}/>{label}
          </label>)}
          <button type="button" aria-label={'Сотворить '+spell.id} disabled={spell.level===0||spell.slotless}
            onClick={()=>cast(spell.id)}>Сотворить · {pool==='pact'?'договор':'обычная ячейка'}</button>
        </div>
        <div className="dndadvanced-row">
          <label>Время <input aria-label={'Время '+spell.id} maxLength={100} value={spell.castingTime??''}
            onChange={e=>edit(d=>{const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.castingTime=e.target.value;})}/></label>
          <label>Дистанция <input aria-label={'Дистанция '+spell.id} maxLength={100} value={spell.range??''}
            onChange={e=>edit(d=>{const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.range=e.target.value;})}/></label>
          <label>Длительность <input aria-label={'Длительность '+spell.id} maxLength={100} value={spell.duration??''}
            onChange={e=>edit(d=>{const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.duration=e.target.value;})}/></label>
        </div>
        <RichDescription id={'spell-'+spell.id} label={'Описание '+spell.name} sheet={sheet}
          value={spell.description??''}
          onChange={v=>edit(d=>{const row=d.spellcasting.spells.find(x=>x.id===spell.id);if(row)row.description=v;})}/>
      </article>)}
      {spells.length===0&&<p>Пока нет заклинаний выбранного круга.</p>}
    </div>
    <div className="dndadvanced-slot-rows">
      {(['normal','pact'] as const).map(kind=><section key={kind} aria-label={kind==='normal'?'Обычные ячейки':'Ячейки договора'}>
        <strong>{kind==='normal'?'Обычные ячейки':'Договор колдуна'}</strong>
        <div className="dndadvanced-slots">
          {Array.from({length:9},(_,i)=>i+1).map(level=>{
            const slot=sheet.spellcasting.slots[kind][String(level)]??{maximum:0,used:0};
            return <div key={level} className="dndadvanced-slot">
              <span>{level}</span>
              <NumericInput label={kind+' '+level+' всего'} value={slot.maximum} max={99}
                onChange={v=>edit(d=>{const old=d.spellcasting.slots[kind][String(level)]??{maximum:0,used:0};
                  d.spellcasting.slots[kind][String(level)]={maximum:v,used:Math.min(v,old.used)};
                })}/>
              <NumericInput label={kind+' '+level+' потрачено'} value={slot.used} max={slot.maximum}
                onChange={v=>edit(d=>{d.spellcasting.slots[kind][String(level)]={...slot,used:v};})}/>
            </div>;
          })}
        </div>
      </section>)}
    </div>
  </section>;
}
function ClassesTab({sheet,edit}:Props){
  const classes=sheet.progression?.classes??[];
  const hasClasses=classes.length>0;
  let suggestion:ReturnType<typeof suggestDndSpellSlots>|null=null,problem='';
  try{if(hasClasses)suggestion=suggestDndSpellSlots(classes,sheet.rulesEdition);}
  catch(err){problem=String(err);}
  const setClass=(id:string,patch:Partial<DndClassLevel>)=>{
    try{
      const updated=classes.map(c=>c.id===id?{...c,...patch}:c);
      const result=assignDndClasses(sheet,updated);
      edit(d=>{d.identity=result.identity;d.progression=result.progression;});
    }catch(err){setError(err instanceof Error?err.message:'Неверные уровни');}
  };
  const [error,setError]=useState('');
  return <section className="dndadvanced-tab" aria-label="Мультикласс D&D">
    <header className="dndadvanced-row"><strong>Классы и уровни</strong>
      <span>Общий уровень: {sheet.identity.level}</span>
      <button type="button" onClick={()=>{
        try{
          const updated=[...classes,{id:uid(),
            name:!hasClasses?(sheet.identity.className||'Класс'): 'Новый класс',
            level:!hasClasses?sheet.identity.level:1,caster:'none' as const}];
          const result=assignDndClasses(sheet,updated);
          edit(d=>{d.identity=result.identity;d.progression=result.progression;});
          setError('');
        }catch(err){setError(err instanceof Error?err.message:'Нет доступных уровней');}
      }}>+ Класс</button>
    </header>
    <p className="dndadvanced-help">Полные уровни заклинателя, половинные (2014 — округление вниз, 2024 — вверх), треть уровней и отдельный договор колдуна. Пересчёт ячеек происходит только по кнопке и не стирает вручную заданные заклинания.</p>
    {error&&<p className="dndadvanced-error" role="alert">{error}</p>}
    {problem&&<p className="dndadvanced-error">{problem}</p>}
    <div className="dndadvanced-collection">
      {classes.map((cls,index)=><div className="dndadvanced-entry dndadvanced-row" key={cls.id}>
        <label>Класс <input aria-label={'Класс мультикласса '+index}
          value={cls.name} maxLength={100}
          onChange={e=>setClass(cls.id,{name:e.target.value})}/></label>
        <NumericInput label={'Уровень класса '+index} value={cls.level} min={1} max={20}
          onChange={v=>setClass(cls.id,{level:v})}/>
        <label>Магия <select aria-label={'Прогрессия класса '+index} value={cls.caster}
          onChange={e=>setClass(cls.id,{caster:e.target.value as DndClassLevel['caster']})}>
          {casterLabels.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select></label>
        <button type="button" aria-label={'Убрать класс '+index} onClick={()=>{
          const rest=classes.filter(c=>c.id!==cls.id);
          if(!rest.length)edit(d=>{delete d.progression;});
          else {
            const next=assignDndClasses(sheet,rest);
            edit(d=>{d.progression=next.progression;d.identity=next.identity;});
          }
          setError('');
        }}>Удалить</button>
      </div>)}
    </div>
    {suggestion&&<div className="dndadvanced-row">
      <span>Объединённый уровень заклинателя: <strong>{suggestion.casterLevel}</strong></span>
      <span>Предлагаемые обычные: {Object.entries(suggestion.normal).map(([k,v])=>k+':'+v.maximum).join(' · ')||'—'}</span>
      <span>Договор: {Object.entries(suggestion.pact).map(([k,v])=>k+':'+v.maximum).join(' · ')||'—'}</span>
      <button type="button" onClick={()=>{
        if(!window.confirm('Применить рекомендованные ячейки? Все вручную установленные максимумы будут заменены, потраченные ячейки будут сохранены по возможности.'))return;
        const result=applySuggestedSlots(sheet);
        edit(d=>{d.spellcasting=result.spellcasting;d.progression=result.progression;});
      }}>Применить рассчитанные ячейки</button>
    </div>}
  </section>;
}
function BonusesTab({sheet,edit}:Props){
  const vars=dndFormulaVariables(sheet);
  const [rollFormula,setRollFormula]=useState('2d20kh1+[STR]');
  const sources=activeDndBonuses(sheet);
  return <section className="dndadvanced-tab" aria-label="Слои бонусов D&D">
    <header className="dndadvanced-row"><strong>Слои бонусов</strong>
      <button type="button" onClick={()=>edit(d=>{
        if(d.bonuses.length<100)d.bonuses.push({id:uid(),source:'Новый бонус',
          target:'ac',op:'add',value:0,active:true});
      })}>+ Бонус</button>
    </header>
    <p className="dndadvanced-help">Порядок: базовое значение → база «_» → модификаторы «+» → множители и пределы → перезапись «=». Выражения могут использовать [LVL], [PROF], [STR] и функции; случайные кости запрещены в постоянных числовых бонусах.</p>
    <div className="dndadvanced-collection">
      {sheet.bonuses.map(bonus=>{
        let preview:string;
        try{preview=String(bonus.formula?.trim()?evaluateDndNumericFormula(bonus.formula,vars):bonus.value??0);}
        catch(err){preview=err instanceof Error?err.message:'Ошибка';}
        return <div className="dndadvanced-entry dndadvanced-row" key={bonus.id}>
          <label><input type="checkbox" aria-label={'Активность бонуса '+bonus.id}
            checked={bonus.active!==false} onChange={e=>edit(d=>{
              const row=d.bonuses.find(x=>x.id===bonus.id);if(row)row.active=e.target.checked;
            })}/>Активен</label>
          <label>Источник <input aria-label={'Источник бонуса '+bonus.id} maxLength={120} value={bonus.source}
            onChange={e=>edit(d=>{
              const row=d.bonuses.find(x=>x.id===bonus.id);if(row)row.source=e.target.value;
            })}/></label>
          <label>Цель <select aria-label={'Цель бонуса '+bonus.id} value={bonus.target}
            onChange={e=>edit(d=>{const row=d.bonuses.find(x=>x.id===bonus.id);if(row)row.target=e.target.value;})}>
            {Array.from(new Set([...bonusTargets,bonus.target])).map(key=><option key={key} value={key}>{key}</option>)}
          </select></label>
          <label>Операция <select aria-label={'Операция бонуса '+bonus.id} value={bonus.op}
            onChange={e=>edit(d=>{const row=d.bonuses.find(x=>x.id===bonus.id);if(row)row.op=e.target.value as DndBonus['op'];})}>
            {([['add','+'],['base','_'],['override','='],['multiply','×'],['min','min'],['max','max'],['advantage','Преим.'],['disadvantage','Помеха']] as const)
              .map(([key,name])=><option key={key} value={key}>{name}</option>)}
          </select></label>
          <BonusFormulaEditor bonus={bonus} sheet={sheet} onCommit={value=>edit(d=>{
            const row=d.bonuses.find(x=>x.id===bonus.id);
            if(row){row.formula=value;delete row.value;}
          })}/>
          <label>Эффект
            <select aria-label={'Источник-эффект бонуса '+bonus.id} value={bonus.effectId??''}
              onChange={e=>edit(d=>{const row=d.bonuses.find(x=>x.id===bonus.id);
                if(row)row.effectId=e.target.value||undefined;})}>
              <option value="">Без эффекта</option>
              {sheet.effects.map(effect=><option key={effect.id} value={effect.id}>{effect.name}</option>)}
            </select>
          </label>
          <output title="Результат формулы">{preview}</output>
          <button type="button" aria-label={'Удалить бонус '+bonus.id}
            onClick={()=>edit(d=>{d.bonuses=d.bonuses.filter(x=>x.id!==bonus.id);})}>×</button>
        </div>;
      })}
    </div>
    <div className="dndadvanced-row">
      <span>Активных бонусов: {sources.length}</span>
      <label>Формула броска
        <input aria-label="D&D формула броска" maxLength={1000} value={rollFormula}
          onChange={e=>setRollFormula(e.target.value)}/>
      </label>
      <button type="button" onClick={()=>emitRoll(()=>rollDndLssFormula(rollFormula,vars))}>Бросить формулу LSS</button>
    </div>
  </section>;
}
function EffectsTab({sheet,edit}:Props){
  const conditions=dndConditionModifiers(sheet);
  return <section className="dndadvanced-tab" aria-label="Эффекты и состояния D&D">
    <header className="dndadvanced-row"><strong>Эффекты и состояния</strong>
      <button type="button" onClick={()=>edit(d=>{
        if(d.effects.length<100)d.effects.push({id:uid(),name:'Новый эффект',active:true,remainingRounds:10});
      })}>+ Эффект</button>
    </header>
    <p className="dndadvanced-help">Состояние и оставшиеся раунды задаются вручную. Некоторые последствия (скорость 0, помеха от отравления/опутывания) учитываются автоматически; контекстные состояния вроде испуга требуют решения мастера.</p>
    <div className="dndadvanced-row"><span>Скорость 0: {conditions.immobile?'да':'нет'}</span>
      <span>Помеха на атаки: {conditions.attackDisadvantage?'да':'нет'}</span>
      <span>Недееспособен: {conditions.incapacitated?'да':'нет'}</span></div>
    {sheet.effects.map(effect=><div className="dndadvanced-entry dndadvanced-row" key={effect.id}>
      <label><input type="checkbox" aria-label={'Активность эффекта '+effect.id}
        checked={effect.active} onChange={e=>edit(d=>{
          const row=d.effects.find(x=>x.id===effect.id);if(row)row.active=e.target.checked;
        })}/>Активен</label>
      <label>Имя <input aria-label={'Имя эффекта '+effect.id} maxLength={120} value={effect.name}
        onChange={e=>edit(d=>{const row=d.effects.find(x=>x.id===effect.id);if(row)row.name=e.target.value;})}/></label>
      <label>Состояние <input aria-label={'Состояние эффекта '+effect.id} maxLength={60}
        placeholder="poisoned, restrained…" value={effect.condition??''}
        onChange={e=>edit(d=>{const row=d.effects.find(x=>x.id===effect.id);if(row)row.condition=e.target.value;})}/></label>
      <NumericInput label={'Осталось раундов '+effect.id} value={effect.remainingRounds??0} max={100000}
        onChange={v=>edit(d=>{const row=d.effects.find(x=>x.id===effect.id);if(row)row.remainingRounds=v;})}/>
      <button type="button" aria-label={'Следующий раунд эффекта '+effect.id}
        onClick={()=>{const next=advanceDndEffect(sheet,effect.id);edit(d=>{d.effects=next.effects;});}}>
        −1 раунд</button>
      <button type="button" aria-label={'Удалить эффект '+effect.id}
        onClick={()=>edit(d=>{d.effects=d.effects.filter(x=>x.id!==effect.id);})}>Удалить</button>
    </div>)}
  </section>;
}
function ResourcesTab({sheet,edit}:Props){
  return <section className="dndadvanced-tab" aria-label="Ресурсы D&D">
    <header className="dndadvanced-row"><strong>Ресурсы персонажа</strong>
      <button type="button" onClick={()=>edit(d=>{
        if(d.resources.length<100)d.resources.push({id:uid(),name:'Новый ресурс',current:1,maximum:1,restoreOn:'long'});
      })}>+ Ресурс</button>
      <button type="button" onClick={()=>{
        if(window.confirm('Короткий отдых: восстановить ресурсы с типом «короткий» и ячейки договора?')){
          const next=restoreDndRest(sheet,'short');edit(d=>{d.resources=next.resources;d.spellcasting=next.spellcasting;});
        }
      }}>Короткий отдых</button>
      <button type="button" onClick={()=>{
        if(window.confirm('Длинный отдых: восстановить ресурсы отдыха и все ячейки?')){
          const next=restoreDndRest(sheet,'long');edit(d=>{d.resources=next.resources;d.spellcasting=next.spellcasting;});
        }
      }}>Длинный отдых</button>
    </header>
    {sheet.resources.map(r=><div key={r.id} className="dndadvanced-entry dndadvanced-row">
      <label>Название <input aria-label={'Имя ресурса '+r.id} maxLength={120} value={r.name}
        onChange={e=>edit(d=>{const row=d.resources.find(x=>x.id===r.id);if(row)row.name=e.target.value;})}/></label>
      <button aria-label={'Потратить ресурс '+r.id} type="button"
        onClick={()=>{const next=updateDndResource(sheet,r.id,-1);edit(d=>{d.resources=next.resources;});}}>−</button>
      <output>{r.current} / {r.maximum}</output>
      <button aria-label={'Восстановить единицу ресурса '+r.id} type="button"
        onClick={()=>{const next=updateDndResource(sheet,r.id,1);edit(d=>{d.resources=next.resources;});}}>+</button>
      <NumericInput label={'Максимум ресурса '+r.id} value={r.maximum} min={1} max={100000}
        onChange={v=>edit(d=>{const row=d.resources.find(x=>x.id===r.id);
          if(row){row.maximum=v;row.current=Math.min(row.current,v);}
        })}/>
      <label>Восстановление <select aria-label={'Отдых ресурса '+r.id} value={r.restoreOn}
        onChange={e=>edit(d=>{const row=d.resources.find(x=>x.id===r.id);
          if(row)row.restoreOn=e.target.value as DndResource['restoreOn'];})}>
        <option value="short">Короткий</option><option value="long">Длинный</option>
        <option value="manual">Только вручную</option>
      </select></label>
      <button type="button" aria-label={'Удалить ресурс '+r.id}
        onClick={()=>edit(d=>{d.resources=d.resources.filter(x=>x.id!==r.id);})}>Удалить</button>
    </div>)}
  </section>;
}
function FeaturesTab({sheet,edit}:Props){
  return <section className="dndadvanced-tab" aria-label="Способности и умения D&D">
    <header className="dndadvanced-row"><strong>Способности, умения и особенности</strong>
      <button type="button" onClick={()=>edit(d=>{
        if((d.features??[]).length<100)d.features=[...(d.features??[]),
          {id:uid(),name:'Новая способность',source:'Класс / вид',description:'',active:true}];
      })}>+ Способность</button>
    </header>
    {(sheet.features??[]).map(feature=><article className="dndadvanced-entry" key={feature.id}>
      <div className="dndadvanced-row">
        <label><input type="checkbox" aria-label={'Активность способности '+feature.id}
          checked={feature.active} onChange={e=>edit(d=>{
            const row=d.features?.find(x=>x.id===feature.id);if(row)row.active=e.target.checked;
          })}/>Активна</label>
        <label>Название <input aria-label={'Имя способности '+feature.id} maxLength={120}
          value={feature.name} onChange={e=>edit(d=>{
            const row=d.features?.find(x=>x.id===feature.id);if(row)row.name=e.target.value;
          })}/></label>
        <label>Источник <input aria-label={'Источник способности '+feature.id} maxLength={120}
          value={feature.source} onChange={e=>edit(d=>{
            const row=d.features?.find(x=>x.id===feature.id);if(row)row.source=e.target.value;
          })}/></label>
        <button type="button" aria-label={'Удалить способность '+feature.id}
          onClick={()=>edit(d=>{d.features=d.features?.filter(x=>x.id!==feature.id);})}>Удалить</button>
      </div>
      <RichDescription id={'feature-'+feature.id} label={'Описание '+feature.name}
        value={feature.description} sheet={sheet}
        onChange={v=>edit(d=>{const row=d.features?.find(x=>x.id===feature.id);if(row)row.description=v;})}/>
    </article>)}
  </section>;
}
export default function AdvancedDndPanel({sheet,edit}:Props){
  const [opened,setOpened]=useState(false),[active,setActive]=useState<Tab>('spells');
  return <section className="dndadvanced-panel" aria-label="Расширенные механики D&D" data-dndadvanced="1">
    <header className="dndadvanced-header">
      <h2>Расширенные механики D&D</h2>
      <button type="button" aria-expanded={opened} onClick={()=>setOpened(v=>!v)}>
        {opened?'Свернуть механику':'Открыть Гримуар, ресурсы и бонусы'}
      </button>
    </header>
    {opened&&<>
      <nav className="dndadvanced-tabs" aria-label="Разделы расширенного D&D">
        {tabs.map(tab=><button key={tab.id} type="button" aria-pressed={tab.id===active}
          onClick={()=>setActive(tab.id)}>{tab.name}</button>)}
      </nav>
      {active==='spells'&&<SpellsTab sheet={sheet} edit={edit}/>}
      {active==='classes'&&<ClassesTab sheet={sheet} edit={edit}/>}
      {active==='bonuses'&&<BonusesTab sheet={sheet} edit={edit}/>}
      {active==='effects'&&<EffectsTab sheet={sheet} edit={edit}/>}
      {active==='resources'&&<ResourcesTab sheet={sheet} edit={edit}/>}
      {active==='features'&&<FeaturesTab sheet={sheet} edit={edit}/>}
    </>}
  </section>;
}
