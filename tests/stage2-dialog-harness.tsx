import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../src/styles.css';
import '../src/site-theme.css';
import {useModalAccessibility} from '../src/lib/use-modal-accessibility';
function Test(){
  const [open,setOpen]=useState(false);
  useModalAccessibility(open,()=>setOpen(false));
  return <main className="site-shell">
    <header className="site-header">Шапка над содержимым</header>
    <button id="open-dialog" type="button" onClick={()=>setOpen(true)}>Открыть окно</button>
    {open&&<div className="modal-backdrop">
      <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="test-title">
        <div className="modal-top">ТЕСТ</div>
        <h2 id="test-title">ОченьДлинноеНазваниеБезПробеловДляПроверкиПереносов123456789012345678901234567890</h2>
        <label className="form-label">Название <input id="first-field" autoFocus placeholder="Введите название"/></label>
        <p>Проверяем длинные формы и высоту экрана.</p>
        {Array.from({length:15},(_,i)=><label className="form-label" key={i}>Поле {i}<input type="text"/></label>)}
        <button id="last-button" type="button" onClick={()=>setOpen(false)}>Закрыть</button>
      </section>
    </div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Test/>);
