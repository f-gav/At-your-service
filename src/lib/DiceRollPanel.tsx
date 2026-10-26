import {useEffect,useState} from 'react';
import {Dices,X,Trash2,ChevronDown,ChevronUp} from 'lucide-react';
import {DICE_ROLL_EVENT,rollDiceFormula} from './dice-engine';
import type {DiceResult} from './dice-engine';
import './DiceRollPanel.css';

/** A character-local journal for now. Roll events contain no network requests.
 * When rooms are introduced, this event can be forwarded to the room log
 * only with the player's explicit permission.
 */
export default function DiceRollPanel(){
  const [history,setHistory]=useState<(DiceResult & {id:number})[]>([]);
  const [open,setOpen]=useState(false);
  const [formula,setFormula]=useState('1d20');
  const [error,setError]=useState('');
  useEffect(()=>{
    const receive=(event:Event)=>{
      const roll=(event as CustomEvent<DiceResult>).detail;
      if(!roll||typeof roll.total!=='number')return;
      setHistory(previous=>[{...roll,id:Date.now()+Math.random()},...previous].slice(0,20));
      setError('');setOpen(true);
    };
    window.addEventListener(DICE_ROLL_EVENT,receive);
    return()=>window.removeEventListener(DICE_ROLL_EVENT,receive);
  },[]);
  const makeRoll=()=>{
    try {
      const result=rollDiceFormula(formula);
      window.dispatchEvent(new CustomEvent(DICE_ROLL_EVENT,{detail:result}));
    }catch(err){setError(err instanceof Error?err.message:'Ошибка формулы');setOpen(true);}
  };
  return <aside className={'ays-dice-dock'+(open?' ays-dice-dock-open':'')} aria-label="Локальные броски костей">
    {open&&<div className="ays-dice-panel">
      <header className="ays-dice-title">
        <span><Dices size={18}/> Броски кубиков</span>
        <div>
          <button type="button" onClick={()=>setHistory([])} title="Очистить историю"
            aria-label="Очистить историю бросков"><Trash2 size={16}/></button>
          <button type="button" onClick={()=>setOpen(false)} title="Свернуть"
            aria-label="Свернуть броски"><X size={18}/></button>
        </div>
      </header>
      <form className="ays-dice-form" onSubmit={event=>{event.preventDefault();makeRoll();}}>
        <input value={formula} onChange={event=>setFormula(event.target.value)}
          maxLength={1000} placeholder="2d6+3 или 1к20" aria-label="Формула кубиков"/>
        <button type="submit">Бросить</button>
      </form>
      {error&&<p className="ays-dice-error" role="alert">{error}</p>}
      <div className="ays-dice-history" aria-live="polite">
        {history.length===0&&<p className="ays-dice-empty">Выделите формулу в листе и нажмите значок d20 — или введите бросок здесь.</p>}
        {history.map((roll,index)=><section key={roll.id} className="ays-dice-result">
          <div className="ays-dice-result-head">
            <span>{roll.label||roll.formula}</span>
            <strong aria-label={'Итог броска '+roll.total}>{roll.total}</strong>
          </div>
          <small>{roll.formula}{index===0?' · последний бросок':''}</small>
          {roll.dice.length>0&&<div className="ays-dice-faces">
            {roll.dice.map((part,partIndex)=><div key={partIndex}>
              <b>{part.notation}:</b>{' '}
              {part.faces.map((face,faceIndex)=><span key={faceIndex}
                className={part.kept[faceIndex]?'':'ays-dice-dropped'}>{face}{faceIndex===part.faces.length-1?'':', '}</span>)}
              {' '}= {part.subtotal}
            </div>)}
          </div>}
        </section>)}
      </div>
      <p className="ays-dice-footnote">Броски пока локальные. Отправка в комнаты появится отдельно.</p>
    </div>}
    <button className="ays-dice-toggle" type="button" onClick={()=>setOpen(x=>!x)}
      title={open?'Свернуть броски':'Открыть броски'} aria-label={open?'Свернуть броски':'Открыть броски'}>
      <Dices size={20}/> {history.length>0&&<output>{history[0].total}</output>}
      {open?<ChevronDown size={14}/>:<ChevronUp size={14}/>}
    </button>
  </aside>;
}
