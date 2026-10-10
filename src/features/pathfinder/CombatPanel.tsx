import { useState } from 'react';
import type { SheetValues, FieldValue } from './sheet-values';
import { calculateCombat, WEAPON_IDS, ARMOR_CATEGORIES,
  WEAPON_CATEGORIES, weaponResult, shieldIsBroken, applyShieldBlock } from './rules-combat';
import './CombatPanel.css';

type Props = {
  values: SheetValues;
  onChange: (id:string,value:FieldValue)=>void;
  onMultiple: (next:SheetValues)=>void;
  automatic: boolean;
  disabled: boolean;
};
const value = (v:SheetValues,id:string) => String(v[id] ?? '');

export default function CombatPanel({values:v,onChange,onMultiple,automatic,disabled}:Props) {
  const [damage,setDamage] = useState('0');
  const [notice,setNotice] = useState('');
  const output=automatic?calculateCombat(v):{};
  const input=(id:string,label:string,description?:string) =>
    <label key={id} className="pf-combat-input">{label}
      <input aria-label={label} type="text" inputMode="numeric" value={value(v,id)}
        onChange={event=>onChange(id,event.target.value)} disabled={disabled} placeholder="0" />
      {description&&<small>{description}</small>}
    </label>;
  const select=(id:string,label:string,options:readonly string[])=>
    <label key={id} className="pf-combat-input">{label}
      <select value={value(v,id)} onChange={event=>onChange(id,event.target.value)} disabled={disabled}>
        <option value="">— Выбери —</option>
        {options.map((name,index)=><option key={name} value={index}>{name}</option>)}
      </select>
    </label>;
  const toggle=(id:string,label:string)=>
    <label className="pf-combat-checkbox" key={id}>
      <input type="checkbox" checked={v[id]==='true'||v[id]===true}
        onChange={event=>onChange(id,event.target.checked?'true':'false')} disabled={disabled}/>
      {label}
    </label>;
  const strSelect=(id:string,label:string,opts:readonly {id:string;name:string}[])=>
    <label className="pf-combat-input">{label}
      <select value={value(v,id)} onChange={event=>onChange(id,event.target.value)} disabled={disabled}>
        <option value="">— Выбери —</option>
        {opts.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </label>;
  function block(){
    const d=Number(damage);
    if(!/^\d+$/.test(damage.trim())||!Number.isSafeInteger(d)||d>100000) {
      setNotice('Укажи неотрицательное целое значение урона.');
      return;
    }
    try{
      const next=applyShieldBlock(v,d);
      onMultiple(next);
      setNotice('Блок применён. Проверь изменения ПЗ и сохрани лист.');
    }catch(error){setNotice(error instanceof Error?error.message:'Ошибка блока щитом');}
  }
  return <section className="pf-combat-panel" aria-label="Механики боя PF2e">
    <header>
      <strong>Бой и снаряжение</strong>
      <span>Настройки персонажа сохраняются вместе с листом. Формулы работают только при включённом режиме «Расчёты: авто».</span>
    </header>
    {!automatic&&<p className="pf-combat-warning">Сейчас включён ручной режим. Настройки можно заполнить заранее, но вычисляемые поля пока не изменятся.</p>}
    <div className="pf-combat-sections">
      <details open>
        <summary>Броня и КД</summary>
        <div className="pf-combat-details">
          {toggle('combat_armor_enabled','Рассчитывать КД по надетой броне')}
          {toggle('combat_armor_skill_penalty_enabled','Учитывать штраф брони в навыках')}
          <div className="pf-combat-grid">
            {select('combat_armor_category','Надетая броня',ARMOR_CATEGORIES)}
            {input('combat_armor_dex_cap','Ограничение Ловкости','Без брони можно оставить пустым.')}
            {input('combat_armor_item_bonus','Бонус КД от брони')}
            {input('combat_armor_other_ac','Дополнительная поправка КД','Избегай суммирования бонусов одного типа.')}
            {input('combat_armor_check_penalty','Штраф проверок брони','Положительное число, например 2.')}
            {input('combat_armor_strength_requirement','Требование Силы','При достаточной Силе штраф проверок снимается.')}

          </div>
          <p className="pf-combat-result">КД: <strong>{output.armor_class??'—'}</strong> · Ловкость: {output.armor_dex??'—'} · Владение: {output.armor_prof??'—'}</p>
        </div>
      </details>
      <details>
        <summary>Щит и блокирование</summary>
        <div className="pf-combat-details">
          <div className="pf-combat-checks">
            {toggle('combat_shield_enabled','Автоматически считать порог поломки')}
            {toggle('combat_shield_raised','Щит поднят (+КД)')}
            {toggle('combat_can_shield_block','Есть реакция «Блок щитом»')}
          </div>
          <div className="pf-combat-grid">
            {input('combat_shield_ac_bonus','Бонус щита к КД','У обычного щита +2.')}
          </div>
          <p className="pf-combat-hint">Твёрдость, максимум и текущие ПЗ щита вводятся в самом бланке. Поломанный щит не даёт бонус КД; половина максимума ПЗ — порог поломки. Блокирование требует поднятого, целого щита и соответствующей реакции.</p>
          <p className="pf-combat-result">{shieldIsBroken(v)?'Щит сломан: бонус к КД недоступен.':'Щит исправен либо параметры целостности не указаны.'}</p>
          <div className="pf-combat-block">
            <label>Полученный урон <input aria-label="Урон для блока щитом" type="number" min="0" step="1" max="100000" value={damage} disabled={disabled} onChange={event=>setDamage(event.target.value)}/></label>
            <button type="button" disabled={disabled} onClick={block}>Применить блок щитом</button>
          </div>
          {notice&&<p className="pf-combat-hint" role="status">{notice}</p>}
        </div>
      </details>
      <details>
        <summary>Пункты здоровья</summary>
        <div className="pf-combat-details">
          {toggle('combat_hp_enabled','Автоматически рассчитывать максимальные ПЗ')}
          <div className="pf-combat-grid">
            {input('combat_hp_ancestry','ПЗ народа на 1-м уровне')}
            {input('combat_hp_class','ПЗ класса за уровень')}
            {input('combat_hp_extra_per_level','Дополнительные ПЗ за уровень')}
            {input('combat_hp_extra_flat','Прочие постоянные ПЗ')}
          </div>
          <p className="pf-combat-result">Максимум: <strong>{output.hp_max??'—'}</strong> · Текущие: {value(v,'hp_current')||'—'} · Временные: {value(v,'hp_temp')||'—'}</p>
          <p className="pf-combat-hint">Текущие и временные ПЗ не перезаписываются расчётом максимума. Изменение уровня не восстанавливает здоровье автоматически.</p>
        </div>
      </details>
      <details>
        <summary>Оружие — пять записей</summary>
        <div className="pf-combat-details">
          <p className="pf-combat-hint">Название оружия остаётся в бланке. Каждое оружие рассчитывается отдельно; фехтовальное использует Ловкость для атаки, но не для урона.</p>
          {WEAPON_IDS.map(i=>{
            const w=weaponResult(v,i), p='combat_weapon_'+i+'_';
            const format=(x:number)=> x>=0?'+'+x:String(x);
            return <div className="pf-combat-weapon" key={i}>
              <div className="pf-combat-weapon-head">
                <strong>{i}. {value(v,'weapon_'+i+'_name')||'Оружие'}</strong>
                {toggle(p+'enabled','Считать')}
              </div>
              <div className="pf-combat-grid">
                {select(p+'category','Владение',WEAPON_CATEGORIES)}
                {strSelect(p+'kind','Способ атаки',[
                  {id:'melee',name:'Ближний бой'},{id:'ranged',name:'Дистанционное'},{id:'thrown',name:'Метательное'},
                ])}
                {input(p+'dice','Кости урона (например 1d8)')}
                {input(p+'item_attack','Бонус предмета к атаке')}
                {input(p+'other_attack','Прочая поправка к атаке')}
                {input(p+'other_damage','Прочая поправка к урону')}
              </div>
              <div className="pf-combat-checks">
                {toggle(p+'finesse','Фехтовальное (finesse)')}
                {toggle(p+'agile','Ловкое (agile)')}
                {toggle(p+'propulsive','Тяговое (propulsive)')}
              </div>
              <p className="pf-combat-result">Атаки: {w?format(w.attack)+' / '+format(w.second)+' / '+format(w.third):'—'} · Урон: {w?.damage||'—'}</p>
            </div>;
          })}
          <p className="pf-combat-hint">Штраф атак: 0 / −5 / −10 (у ловкого оружия 0 / −4 / −8). Бонус руны мощи укажи в бонусе к атаке, а дополнительную кость striking — в числе костей урона.</p>
        </div>
      </details>
    </div>
  </section>;
}
