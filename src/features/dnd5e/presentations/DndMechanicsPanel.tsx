import {useState} from 'react';
import type {Dnd5eSheet,DndClassLevel,DndResource,DndBonus} from '../domain/model';
import {ABILITIES} from '../domain/model';
import type {EditDnd} from './Classic2014Pages';
import RichField from '../../rich-editor/RichField';
import {
  castSpell,selectSpells,resetResources,spendResource,
  multiclassSlots,rollDndFormula,evaluateDndExpression,
  tickDndEffects,resourceMaximum
} from '../domain/advanced';
import {applyDndBonuses} from '../domain/bonuses';
import './DndMechanicsPanel.css';
type Props={sheet:Dnd5eSheet;edit:EditDnd};
type Tab='spells'|'resources'|'bonuses'|'classes'|'rolls';
const uid=()=>crypto.randomUUID();
export default function DndMechanicsPanel({sheet,edit}:Props){
  const [tab,setTab]=useState<Tab>('spells');
  const [formula,setFormula]=useState('2d20kh1+[PROF]');
  const [result,setResult]=useState('');
  const [error,setError]=useState('');
  const fail=(fn:()=>void)=>{try{setError('');fn();}catch(e){setError(e instanceof Error?e.message:String(e));}};
  const spellList=sheet.spellcasting.spells;
  const classes=sheet.classes??[];
  const resources=sheet.resources??[];
  const effects=sheet.effects??[];
  const features=sheet.features??[];
  const editSpell=(id:string,update:(s:Dnd5eSheet['spellcasting']['spells'][number])=>void)=>
    edit(d=>{const record=d.spellcasting.spells.find(s=>s.id===id);if(record)update(record);});
  const caster=multiclassSlots(classes,sheet.rulesEdition);
  return <section className="dnd-mechanics" aria-label="Дополнительные механики D&D" data-dnd-mechanics="v1">
    <div className="dnd-mechanics-head">
      <strong>Механики персонажа</strong><span>Общие данные для листов 2014 и 2024</span>
    </div>
    <div className="dnd-mechanics-tabs" role="tablist" aria-label="Механики D&D">
      {([
        ['spells','Гримуар'],['resources','Ресурсы и состояния'],
        ['bonuses','Бонусы'],['classes','Классы и способности'],['rolls','Формулы'],
      ] as const).map(([value,label])=><button key={value} type="button" role="tab"
        aria-selected={tab===value} onClick={()=>{setTab(value);setError('');}}>
        {label}
      </button>)}
    </div>
    {error&&<p className="dnd-mechanics-error" role="alert">{error}</p>}
    {tab==='spells'&&<div className="dnd-mechanics-section">
      <div className="dnd-mechanics-summary">
        <strong>Известно: {selectSpells(sheet,'known').length}</strong>
        <span>Подготовлено: {selectSpells(sheet,'prepared').length}</span>
        <span>В книге: {selectSpells(sheet,'book').length}</span>
        <button type="button" onClick={()=>edit(d=>d.spellcasting.spells.push({
          id:uid(),name:'Новое заклинание',level:1,source:'homebrew',known:true,prepared:false,
          inBook:false,granted:false,notes:'',
        }))}>+ Заклинание</button>
      </div>
      <div className="dnd-mechanics-table-scroll"><table>
        <thead><tr><th>Название</th><th>Круг</th><th>Изв.</th><th>Подг.</th><th>Книга</th><th>Дано</th><th>Источник</th><th>Потратить ячейку</th><th/></tr></thead>
        <tbody>{spellList.map(spell=><tr key={spell.id}>
          <td><input aria-label={'Название заклинания '+spell.id} value={spell.name}
            maxLength={150} onChange={e=>editSpell(spell.id,s=>{s.name=e.target.value;})}/></td>
          <td><select aria-label={'Круг заклинания '+spell.id} value={spell.level}
            onChange={e=>editSpell(spell.id,s=>{s.level=Number(e.target.value);})}>
            {Array.from({length:10},(_,i)=><option key={i} value={i}>{i}</option>)}
          </select></td>
          {(['known','prepared','inBook','granted'] as const).map((key)=><td key={key}>
            <input type="checkbox" aria-label={key+' '+spell.id}
              checked={spell[key]===true} onChange={e=>editSpell(spell.id,s=>{s[key]=e.target.checked;})}/>
          </td>)}
          <td><select aria-label={'Источник '+spell.id} value={spell.source}
            onChange={e=>editSpell(spell.id,s=>{s.source=e.target.value;})}>
            {['homebrew','srd-5.1','srd-5.2.1','imported'].map(source=>
              <option key={source} value={source}>{source}</option>)}
          </select></td>
          <td><div className="dnd-mechanics-cast">
            <button type="button" disabled={spell.level===0}
              onClick={()=>fail(()=>edit(d=>Object.assign(d,castSpell(d,spell.id,'normal',spell.level))))}>
              Обычная
            </button>
            <button type="button" disabled={spell.level===0}
              onClick={()=>fail(()=>edit(d=>{
                const level=Object.keys(d.spellcasting.slots.pact).find(key=>
                  Number(key)>=spell.level&&
                  d.spellcasting.slots.pact[key].used<d.spellcasting.slots.pact[key].maximum);
                Object.assign(d,castSpell(d,spell.id,'pact',Number(level??spell.level)));
              }))}>
              Договорная
            </button>
          </div></td>
          <td><button type="button" aria-label={'Удалить заклинание '+spell.name}
            onClick={()=>edit(d=>{d.spellcasting.spells=d.spellcasting.spells.filter(s=>s.id!==spell.id);})}>×</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="dnd-mechanics-slot-pools">
        {(['normal','pact'] as const).map(pool=><div key={pool}>
          <h4>{pool==='normal'?'Обычные ячейки':'Ячейки договора колдуна'}</h4>
          <div className="dnd-mechanics-slot-row">
            {Array.from({length:9},(_,i)=>i+1).map(level=>{
              const slot=sheet.spellcasting.slots[pool][level]??{maximum:0,used:0};
              return <label key={level}><span>{level} круг</span>
                <input aria-label={pool+' максимум '+level} type="number" min="0" max="99"
                  value={slot.maximum} onChange={e=>edit(d=>{
                    const max=Math.max(0,Math.min(99,Number(e.target.value)||0));
                    d.spellcasting.slots[pool][level]={maximum:max,used:Math.min(slot.used,max)};
                  })}/>
                <input aria-label={pool+' потрачено '+level} type="number" min="0" max={slot.maximum}
                  value={slot.used} onChange={e=>edit(d=>{
                    d.spellcasting.slots[pool][level]={maximum:slot.maximum,
                      used:Math.min(slot.maximum,Math.max(0,Number(e.target.value)||0))};
                  })}/>
              </label>;
            })}
          </div>
        </div>)}
      </div>
      <p className="dnd-mechanics-help">Состояния «известно», «подготовлено», «в книге», «дано» хранятся отдельно. Ячейки договора и обычные ячейки не объединяются.</p>
    </div>}
    {tab==='resources'&&<div className="dnd-mechanics-section">
      <div className="dnd-mechanics-summary">
        <button type="button" onClick={()=>edit(d=>d.resources.push({
          id:uid(),name:'Новый ресурс',current:1,maximum:1,reset:'long'
        }))}>+ Ресурс</button>
        <button type="button" onClick={()=>edit(d=>Object.assign(d,resetResources(d,'short')))}>Короткий отдых</button>
        <button type="button" onClick={()=>edit(d=>Object.assign(d,resetResources(d,'long')))}>Долгий отдых</button>
        <button type="button" onClick={()=>edit(d=>Object.assign(d,tickDndEffects(d)))}>Следующий раунд</button>
      </div>
      {resources.map(resource=><div className="dnd-mechanics-row" key={resource.id}>
        <input aria-label={'Имя ресурса '+resource.id} value={resource.name}
          onChange={e=>edit(d=>{const r=d.resources.find(r=>r.id===resource.id);if(r)r.name=e.target.value;})}/>
        <span>{resource.current} / {resourceMaximum(resource,sheet)}</span>
        <button type="button" onClick={()=>fail(()=>edit(d=>Object.assign(d,spendResource(d,resource.id))))}>−1</button>
        <button type="button" onClick={()=>edit(d=>{
          const r=d.resources.find(r=>r.id===resource.id);
          if(r)r.current=Math.min(r.maximum,r.current+1);
        })}>+1</button>
        <label>Макс. <input type="number" min="0" max="9999" aria-label={'Максимум ресурса '+resource.id}
          value={resource.maximum} onChange={e=>edit(d=>{
            const r=d.resources.find(r=>r.id===resource.id);
            if(r){r.maximum=Math.max(0,Math.min(9999,Number(e.target.value)||0));r.current=Math.min(r.current,r.maximum);}
          })}/></label>
        <select aria-label={'Восстановление '+resource.id} value={resource.reset}
          onChange={e=>edit(d=>{const r=d.resources.find(r=>r.id===resource.id);if(r)r.reset=e.target.value as DndResource['reset'];})}>
          <option value="short">Короткий</option><option value="long">Долгий</option><option value="manual">Вручную</option>
        </select>
        <button type="button" onClick={()=>edit(d=>{d.resources=d.resources.filter(r=>r.id!==resource.id);})}>×</button>
      </div>)}
      <h4>Активные эффекты и состояния</h4>
      <button type="button" onClick={()=>edit(d=>d.effects.push({id:uid(),name:'Новый эффект',active:true,rounds:10}))}>+ Эффект</button>
      {effects.map(effect=><div className="dnd-mechanics-row" key={effect.id}>
        <label><input type="checkbox" aria-label={'Активен '+effect.id} checked={effect.active}
          onChange={e=>edit(d=>{const x=d.effects.find(x=>x.id===effect.id);if(x)x.active=e.target.checked;})}/>Активен</label>
        <input aria-label={'Название эффекта '+effect.id} value={effect.name}
          onChange={e=>edit(d=>{const x=d.effects.find(x=>x.id===effect.id);if(x)x.name=e.target.value;})}/>
        <input aria-label={'Состояние эффекта '+effect.id} placeholder="poisoned / grappled" value={effect.condition??''}
          onChange={e=>edit(d=>{const x=d.effects.find(x=>x.id===effect.id);if(x)x.condition=e.target.value;})}/>
        <label>Раунды <input type="number" aria-label={'Раунды '+effect.id} min="0" max="99999"
          value={effect.rounds??0} onChange={e=>edit(d=>{const x=d.effects.find(x=>x.id===effect.id);if(x)x.rounds=Math.max(0,Number(e.target.value)||0);})}/></label>
        <button type="button" onClick={()=>edit(d=>{d.effects=d.effects.filter(x=>x.id!==effect.id);})}>×</button>
      </div>)}
    </div>}
    {tab==='bonuses'&&<div className="dnd-mechanics-section">
      <div className="dnd-mechanics-summary">
        <button type="button" onClick={()=>edit(d=>d.bonuses.push({
          id:uid(),source:'Ручной бонус',target:'ac',op:'add',value:1,active:true
        }))}>+ Бонус</button>
      </div>
      {sheet.bonuses.map(bonus=><div className="dnd-mechanics-row" key={bonus.id}>
        <input aria-label={'Источник бонуса '+bonus.id} value={bonus.source}
          onChange={e=>edit(d=>{const b=d.bonuses.find(b=>b.id===bonus.id);if(b)b.source=e.target.value;})}/>
        <input aria-label={'Цель бонуса '+bonus.id} value={bonus.target}
          onChange={e=>edit(d=>{const b=d.bonuses.find(b=>b.id===bonus.id);if(b)b.target=e.target.value;})}/>
        <select aria-label={'Операция бонуса '+bonus.id} value={bonus.op}
          onChange={e=>edit(d=>{const b=d.bonuses.find(b=>b.id===bonus.id);if(b)b.op=e.target.value as DndBonus['op'];})}>
          {['add','base','multiply','min','max','override','advantage','disadvantage'].map(x=><option key={x} value={x}>{x}</option>)}
        </select>
        <input type="number" aria-label={'Величина бонуса '+bonus.id} value={bonus.value??0}
          onChange={e=>edit(d=>{const b=d.bonuses.find(b=>b.id===bonus.id);if(b)b.value=Number(e.target.value)||0;})}/>
        <label><input aria-label={'Включён бонус '+bonus.id} type="checkbox" checked={bonus.active!==false}
          onChange={e=>edit(d=>{const b=d.bonuses.find(b=>b.id===bonus.id);if(b)b.active=e.target.checked;})}/>Вкл.</label>
        <button type="button" onClick={()=>edit(d=>{d.bonuses=d.bonuses.filter(b=>b.id!==bonus.id);})}>×</button>
      </div>)}
      <p className="dnd-mechanics-help">Цели: ac, initiative, hp.max, speed.walk, skill.stealth, save.dex, attack, ability.str и др. Порядок: база → сложение → умножение → ограничения → переопределение.</p>
      <output>КЗ после бонусов: {applyDndBonuses(10,'ac',sheet.bonuses).value} (пример для базы 10)</output>
    </div>}
    {tab==='classes'&&<div className="dnd-mechanics-section">
      <div className="dnd-mechanics-summary">
        <button type="button" onClick={()=>edit(d=>{d.classes??=[];d.classes.push({id:uid(),name:'Новый класс',level:1,spellcasting:'none'});})}>+ Класс</button>
        <span>Уровень заклинателя: {caster.casterLevel}</span>
        <span>Рекомендуемые обычные ячейки: {Object.values(caster.slots).join(' / ')}</span>
      </div>
      {classes.map(c=><div className="dnd-mechanics-row" key={c.id}>
        <input aria-label={'Класс '+c.id} value={c.name} onChange={e=>edit(d=>{const v=d.classes?.find(x=>x.id===c.id);if(v)v.name=e.target.value;})}/>
        <label>Уровень<input aria-label={'Уровень класса '+c.id} type="number" min="1" max="20"
          value={c.level} onChange={e=>edit(d=>{const v=d.classes?.find(x=>x.id===c.id);if(v)v.level=Math.max(1,Math.min(20,Number(e.target.value)||1));})}/></label>
        <select aria-label={'Тип магии '+c.id} value={c.spellcasting??'none'}
          onChange={e=>edit(d=>{const v=d.classes?.find(x=>x.id===c.id);if(v)v.spellcasting=e.target.value as DndClassLevel['spellcasting'];})}>
          <option value="none">Не заклинатель</option><option value="full">Полный</option>
          <option value="half">Половинный</option><option value="third">Третичный</option>
          <option value="pact">Магия договора</option>
        </select>
        <button type="button" onClick={()=>edit(d=>{d.classes=d.classes?.filter(x=>x.id!==c.id);})}>×</button>
      </div>)}
      <div className="dnd-mechanics-summary">
        <button type="button" onClick={()=>edit(d=>{d.features??=[];d.features.push({id:uid(),name:'Новая способность',source:'Класс',description:''});})}>+ Способность</button>
      </div>
      {features.map(f=><div key={f.id} className="dnd-mechanics-feature">
        <input aria-label={'Название способности '+f.id} value={f.name}
          onChange={e=>edit(d=>{const v=d.features?.find(x=>x.id===f.id);if(v)v.name=e.target.value;})}/>
        <input aria-label={'Источник способности '+f.id} value={f.source}
          onChange={e=>edit(d=>{const v=d.features?.find(x=>x.id===f.id);if(v)v.source=e.target.value;})}/>
        <RichField id={'dnd-feature-'+f.id} label={'Описание '+f.name} value={f.description}
          onChange={value=>edit(d=>{const v=d.features?.find(x=>x.id===f.id);if(v)v.description=value;})}/>
        <button type="button" onClick={()=>edit(d=>{d.features=d.features?.filter(x=>x.id!==f.id);})}>Удалить</button>
      </div>)}
      <p className="dnd-mechanics-help">Классы используются для расчёта рекомендаций ячеек, но не изменяют автоматически уже введённые ячейки. Это защищает ручные и импортированные значения.</p>
    </div>}
    {tab==='rolls'&&<div className="dnd-mechanics-section">
      <label className="dnd-mechanics-formula">Формула D&D
        <input aria-label="Формула D&D" value={formula} onChange={e=>setFormula(e.target.value)} maxLength={280}/>
      </label>
      <div className="dnd-mechanics-summary">
        <button type="button" onClick={()=>fail(()=>{
          const roll=rollDndFormula(formula,sheet,()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296);
          setResult(formula+': '+roll.faces.join(', ')+' = '+roll.total);
        })}>Бросить</button>
        <button type="button" onClick={()=>fail(()=>setResult(String(evaluateDndExpression(formula,sheet))))}>Вычислить без кубиков</button>
        <output aria-live="polite">{result}</output>
      </div>
      <p className="dnd-mechanics-help">Примеры: 2d20kh1+[PROF], 2d6+[STR], floor([LVL]/2), 1d6ro=1, 1d6!, if([STR]&gt;=3,2d6,1d6). Неподдерживаемая нотация даёт ошибку.</p>
    </div>}
  </section>;
}
