import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {X,BookOpen} from 'lucide-react';
import type {SheetValues} from './sheet-values';
import {RANK_LABELS,readRank} from './rules-core';
import {
  SPELLCASTING_ABILITIES,SPELL_SLOT_RANKS,spellcastingTotals,
  spellAttackDisplay,spellSlotCountText,
} from './rules-spellcasting';
import {PF_SPELL_MODE,PF_SPELL_TRADITIONS,PF_SPELL_CLASSES,PF_CLASS_LIST,effectivePfTraditions,selectedClasses} from './SpellGrimoire';
import './SpellcastingDialog.css';

type Props={
  values:SheetValues;
  onChange:(id:string,value:string)=>void;
  onRankChange:(rank:number)=>void;
  onClose:()=>void;
  disabled?:boolean;
  onOpenGrimoire:()=>void;
};
export default function SpellcastingDialog({values,onChange,onRankChange,onClose,onOpenGrimoire,disabled=false}:Props){
  const totals=spellcastingTotals(values);
  const mode=values[PF_SPELL_MODE]==='text'?'text':'library';
  const traditions=effectivePfTraditions(values);
  const classes=selectedClasses(values[PF_SPELL_CLASSES]);
  const main=useRef<HTMLDivElement>(null);
  const closeCallback=useRef(onClose);
  closeCallback.current=onClose;
  const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    close.current?.focus();
    const keyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();closeCallback.current();return;}
      if(event.key!=='Tab'||!main.current)return;
      const tabbable=Array.from(main.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled),select:not(:disabled),input:not(:disabled)'
      )).filter(element=>element.getClientRects().length>0);
      if(!tabbable.length)return;
      if(event.shiftKey&&document.activeElement===tabbable[0]){
        event.preventDefault();tabbable[tabbable.length-1].focus();
      }else if(!event.shiftKey&&document.activeElement===tabbable[tabbable.length-1]){
        event.preventDefault();tabbable[0].focus();
      }
    };
    document.addEventListener('keydown',keyDown);
    return ()=>{document.removeEventListener('keydown',keyDown);previousFocus?.focus();};
  },[]);

  const rank=readRank(values.spell_attack_rank)??readRank(values.spell_dc_rank);
  const calculatedAttack=totals.attack===undefined?'—':spellAttackDisplay(totals.attack);
  const calculatedDc=totals.dc===undefined?'—':String(totals.dc);
  return createPortal(
    <div className="pf-spell-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div ref={main} className="pf-spell-dialog" role="dialog" aria-modal="true"
        aria-labelledby="pf-spell-dialog-heading">
        <button className="pf-spell-dialog-close" ref={close} type="button" onClick={onClose}
          aria-label="Закрыть настройки заклинаний"><X size={20}/></button>
        <h2 id="pf-spell-dialog-heading">Настройки заклинаний</h2>
        <div className="pf-spell-dialog-summary">
          <label className="pf-spell-dialog-key">
            <span>Ключевая характеристика</span>
            <select value={totals.keyAbility??''} disabled={disabled}
              onChange={event=>onChange('spellcasting_key_ability',event.target.value)}>
              <option value="">— Выбери —</option>
              {SPELLCASTING_ABILITIES.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <div className="pf-spell-dialog-stat" aria-label="СЛ заклинаний">
            <span>СЛ заклинаний</span>
            <strong>{calculatedDc}</strong>
          </div>
          <div className="pf-spell-dialog-stat" aria-label="Бонус атаки заклинанием">
            <span>Бонус атаки</span>
            <strong>{calculatedAttack}</strong>
          </div>
        </div>
        <div className="pf-spell-dialog-proficiency">
          <label>
            <span>Умение в заклинаниях</span>
            <select value={rank===undefined?'':String(rank)} disabled={disabled}
              onChange={event=>onRankChange(Number(event.target.value))}>
              <option value="" disabled>— Выбери —</option>
              {RANK_LABELS.map((text,i)=><option key={text} value={i}>{text}</option>)}
            </select>
          </label>
          <p>Умение применяется к атаке и СЛ. Итоговый бонус включает уровень персонажа и ключевую характеристику.</p>
        </div>
        {(!totals.keyAbility||totals.level===undefined||totals.abilityModifier===undefined||rank===undefined)&&
          <p className="pf-spell-dialog-warning" role="status">
            Для полного расчёта выбери характеристику, умение и заполни уровень и модификатор характеристики на первой странице.
          </p>}
        <h3>Режим заклинаний</h3>
        <div className="pf-spell-mode-options">
          <label className="pf-spell-mode-toggle">
            <span>Библиотека</span>
            <input type="checkbox" role="switch" aria-label="Режим заклинаний: библиотека"
              checked={mode==='library'} disabled={disabled}
              onChange={event=>onChange(PF_SPELL_MODE,event.target.checked?'library':'text')}/>
            <span className="pf-spell-mode-track" aria-hidden="true"><span/></span>
            <span>Текст</span>
          </label>
          <button type="button" className="pf-open-grimoire-icon" disabled={disabled||mode==='text'} onClick={onOpenGrimoire} aria-label="Открыть гримуар" title="Открыть гримуар"><BookOpen size={20} aria-hidden="true"/></button>
        </div>
        <p className="pf-spell-dialog-footnote">В текстовом режиме выбранные заклинания скрыты на листе, но сохраняются в гримуаре. Ручные записи также сохраняются при переключении.</p>
        <h3>Классы, открывающие заклинания</h3>
        <div className="pf-spell-traditions" aria-label="Доступные классы">
          {PF_CLASS_LIST.map(([id,label])=><label key={id}><input type="checkbox" disabled={disabled}
            checked={classes.includes(id)}
            onChange={e=>onChange(PF_SPELL_CLASSES,JSON.stringify(e.target.checked?[...classes,id]:classes.filter(v=>v!==id)))}/>{label}</label>)}
        </div>
        <p className="pf-spell-dialog-footnote">Для классов с изменяемой магической традицией укажи традицию отдельно. Мультиклассовые архетипы сами по себе не дают все заклинания традиции.</p>
        <h3>Доступные магические традиции</h3>
        <div className="pf-spell-traditions">
          {([['arcane','Мистическая'],['divine','Сакральная'],['occult','Оккультная'],['primal','Первобытная']] as const).map(([id,label])=>
            <label key={id}><input type="checkbox" disabled={disabled} checked={traditions.includes(id)}
              onChange={e=>onChange(PF_SPELL_TRADITIONS,JSON.stringify(e.target.checked?[...traditions,id]:traditions.filter(v=>v!==id)))}/>{label}</label>)}
        </div>
        <h3>Количество ячеек заклинаний</h3>
        <div className="pf-spell-dialog-slots">
          {Array.from({length:SPELL_SLOT_RANKS},(_,i)=>{
            const rankNumber=i+1;
            const id='spell_slots_'+rankNumber;
            const fieldValue=String(values[id]??'');
            return <label key={id}>
              <span>{rankNumber}-й круг</span>
              <input type="number" inputMode="numeric" min={0} max={999} step={1}
                value={fieldValue} disabled={disabled}
                onChange={event=>onChange(id,spellSlotCountText(event.target.value))}
                aria-label={'Количество ячеек заклинаний, '+rankNumber+'-й круг'}/>
            </label>;
          })}
        </div>
        <p className="pf-spell-dialog-footnote">
          Ячейки изменяются и на самом листе. Десятый круг включён отдельно, потому что в Pathfinder 2e он существует.
          Режим библиотеки использует каталог Pathfinder 2e. Чары не расходуют ячейки заклинаний.
        </p>
      </div>
    </div>,document.body
  );
}
