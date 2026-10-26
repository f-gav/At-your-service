import {useEffect,useRef,useState} from 'react';
import {Dices,X,Trash2,ChevronDown,ChevronUp} from 'lucide-react';
import {DICE_ROLL_EVENT,DICE_ERROR_EVENT,rollDiceFormula} from './dice-engine';
import type {DiceResult} from './dice-engine';
import DiceFormulaExamples from './DiceFormulaExamples';
import {supabase} from './supabase';
import './DiceRollPanel.css';

/** A character-local journal for now. Roll events contain no network requests.
 * When rooms are introduced, this event can be forwarded to the room log
 * only with the player's explicit permission.
 */
export default function DiceRollPanel({system='pf2e',characterId}:{
  system?:'pf2e'|'prmoon';characterId?:string;
}){
  const [history,setHistory]=useState<(DiceResult & {id:number})[]>([]);
  const [open,setOpen]=useState(false);
  const [formula,setFormula]=useState('1d20');
  const [error,setError]=useState('');
  const [roomMembership,setRoomMembership]=useState<{room_id:string;casts_enabled:boolean}|null>(null);
  const membershipRef=useRef<{room_id:string;casts_enabled:boolean}|null>(null);
  const [broadcastError,setBroadcastError]=useState('');
  useEffect(()=>{
    if(!supabase||!characterId){membershipRef.current=null;setRoomMembership(null);return;}
    const client=supabase;
    let active=true;
    const refresh=async()=>{
      const {data,error:failure}=await client.from('game_room_members')
        .select('room_id,casts_enabled').eq('character_id',characterId).maybeSingle();
      if(!active)return;
      // A database without the room migration simply has no connected rooms.
      if(failure){membershipRef.current=null;setRoomMembership(null);return;}
      const value=data?{room_id:String(data.room_id),casts_enabled:!!data.casts_enabled}:null;
      membershipRef.current=value;setRoomMembership(value);
    };
    void refresh();
    const timer=window.setInterval(()=>{void refresh();},10000);
    const channel=client.channel('ays-roll-member-'+characterId)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_room_members',
        filter:'character_id=eq.'+characterId},()=>{void refresh();})
      .subscribe();
    return()=>{active=false;window.clearInterval(timer);void client.removeChannel(channel);};
  },[characterId]);
  useEffect(()=>{
    const receive=(event:Event)=>{
      const roll=(event as CustomEvent<DiceResult>).detail;
      if(!roll||typeof roll.total!=='number')return;
      setHistory(previous=>[{...roll,id:Date.now()+Math.random()},...previous].slice(0,20));
      setError('');setOpen(true);
      const current=membershipRef.current;
      if(current?.casts_enabled&&characterId&&supabase){
        void supabase.rpc('post_game_room_roll',{
          p_room:current.room_id,p_character:characterId,
          p_formula:roll.formula,p_label:roll.label,p_total:roll.total,
          p_calculation:roll.calculation,p_dice:roll.dice,
        }).then(({error:postError})=>{
          if(postError)setBroadcastError('Бросок локальный. Не удалось отправить в комнату: '+postError.message);
          else setBroadcastError('');
        });
      }
    };
    const fail=(event:Event)=>{
      const message=(event as CustomEvent<string>).detail;
      setError(typeof message==='string'?message:'Ошибка формулы');
      setOpen(true);
    };
    window.addEventListener(DICE_ROLL_EVENT,receive);
    window.addEventListener(DICE_ERROR_EVENT,fail);
    return()=>{
      window.removeEventListener(DICE_ROLL_EVENT,receive);
      window.removeEventListener(DICE_ERROR_EVENT,fail);
    };
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
      <DiceFormulaExamples system={system}/>
      {roomMembership&&<label className="ays-dice-room-toggle">
        <input type="checkbox" checked={roomMembership.casts_enabled}
          onChange={event=>{
            const enabled=event.target.checked;
            if(!supabase||!characterId)return;
            void supabase.from('game_room_members').update({casts_enabled:enabled})
              .eq('room_id',roomMembership.room_id).eq('character_id',characterId)
              .then(({error:failure})=>{
                if(failure)setBroadcastError(failure.message);
                else {
                  const next={...roomMembership,casts_enabled:enabled};
                  membershipRef.current=next;setRoomMembership(next);setBroadcastError('');
                }
              });
          }}/>
        Отправлять броски в комнату
      </label>}
      {error&&<p className="ays-dice-error" role="alert">{error}</p>}
      {broadcastError&&<p className="ays-dice-error" role="alert">{broadcastError}</p>}
      <div className="ays-dice-history" aria-live="polite">
        {history.length===0&&<p className="ays-dice-empty">Выделите текст на листе и привяжите к нему формулу кнопкой кубиков. Для свободного броска введите формулу выше.</p>}
        {history.map((roll,index)=><section key={roll.id} className="ays-dice-result">
          <div className="ays-dice-result-head">
            <span>{roll.label||roll.formula}</span>
            <strong aria-label={'Итог броска '+roll.total}>{roll.total}</strong>
          </div>
          <small>{roll.formula}{index===0?' · последний бросок':''}</small>
          <div className="ays-dice-faces">
            <div className="ays-dice-calculation">{roll.calculation??(roll.formula+' = '+roll.total)}</div>
            {roll.dice.map((part,partIndex)=>part.kept.some(kept=>!kept)&&
              <div className="ays-dice-excluded" key={partIndex}>
                {part.notation} — отброшено: {' '}
                {part.faces.filter((_,i)=>!part.kept[i]).map((face,i)=>
                  <span className="ays-dice-dropped" key={i}>{i>0?', ':''}{face}</span>)}
              </div>)}
          </div>
        </section>)}
      </div>
      <p className="ays-dice-footnote">{roomMembership
        ?roomMembership.casts_enabled?'Броски отправляются участникам комнаты.':'Отправка в комнату отключена; броски остаются локальными.'
        :'Броски локальные, пока персонаж не подключён к комнате.'}</p>
    </div>}
    <button className="ays-dice-toggle" type="button" onClick={()=>setOpen(x=>!x)}
      title={open?'Свернуть броски':'Открыть броски'} aria-label={open?'Свернуть броски':'Открыть броски'}>
      <Dices size={20}/> {history.length>0&&<output>{history[0].total}</output>}
      {open?<ChevronDown size={14}/>:<ChevronUp size={14}/>}
    </button>
  </aside>;
}
