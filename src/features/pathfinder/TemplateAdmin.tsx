import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,PointerEvent as PE} from 'react';
import {supabase} from '../../lib/supabase';
import {PDF_WIDTH,PDF_HEIGHT} from './layout';
import {DEFAULT_FIELDS,validFields,cloneFields,PAGE_NAMES,TEMPLATE_KEY} from './editor-schema';
import type {EditableField} from './editor-schema';
import { DEFAULT_SELECT_OPTIONS, PF2E_SIZE_OPTIONS, parseOptions } from './field-options';
import ToggleVisual from './ToggleVisual';
import { toggleAppearance } from './toggle-shapes';
import './PathfinderSheet.css';
import './TemplateAdmin.css';
type Change=Partial<EditableField>;
type Drag={id:string;mode:'move'|'size';startX:number;startY:number;original:EditableField;width:number};
export default function TemplateAdmin({userId,onClose}:{userId:string;onClose:()=>void}){
  const [fields,setFields]=useState<EditableField[]>(()=>cloneFields(DEFAULT_FIELDS));
  const [page,setPage]=useState(1),[selected,setSelected]=useState('');
  const [preview,setPreview]=useState(false),[zoom,setZoom]=useState(960),[grid,setGrid]=useState(false);
  const [samples,setSamples]=useState<Record<string,string>>({});
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[status,setStatus]=useState('');
  const [version,setVersion]=useState(0),[versions,setVersions]=useState<number[]>([]),[restore,setRestore]=useState('');
  const [undo,setUndo]=useState<EditableField[][]>([]),[redo,setRedo]=useState<EditableField[][]>([]);
  const pageRef=useRef<HTMLDivElement>(null),drag=useRef<Drag|null>(null);
  const active=fields.find(f=>f.id===selected);
  useEffect(()=>{
    if(!supabase)return;
    let mounted=true;
    void Promise.all([
      supabase.from('sheet_template_drafts').select('fields').eq('template_key',TEMPLATE_KEY).maybeSingle(),
      supabase.from('sheet_templates').select('fields,version').eq('template_key',TEMPLATE_KEY).maybeSingle(),
      supabase.from('sheet_template_history').select('version').eq('template_key',TEMPLATE_KEY).order('version',{ascending:false}).limit(30)
    ]).then(([draft,published,history])=>{
      if(!mounted)return;
      setLoading(false);
      const error=draft.error||published.error||history.error;
      if(error){setStatus('Ошибка загрузки: '+error.message);return;}
      const schema=draft.data?.fields||published.data?.fields||DEFAULT_FIELDS;
      if(!validFields(schema)){setStatus('Ошибка схемы: недопустимые поля');return;}
      setFields(cloneFields(schema));setVersion(published.data?.version||0);
      setVersions((history.data||[]).map(item=>item.version));setStatus('Шаблон загружен.');
    });
    return()=>{mounted=false;};
  },[]);
  useEffect(()=>{
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>event.preventDefault();
    window.addEventListener('beforeunload',warn);
    return()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  function checkpoint(){setUndo(old=>[...old.slice(-39),cloneFields(fields)]);setRedo([]);setDirty(true);}
  function update(id:string,values:Change,record=true){
    if(record)checkpoint();
    setFields(old=>old.map(field=>field.id===id?{...field,...values}:field));setDirty(true);
  }
  function undoOnce(){if(!undo.length)return;setRedo(old=>[...old,cloneFields(fields)]);setFields(cloneFields(undo[undo.length-1]));setUndo(old=>old.slice(0,-1));setDirty(true);}
  function redoOnce(){if(!redo.length)return;setUndo(old=>[...old,cloneFields(fields)]);setFields(cloneFields(redo[redo.length-1]));setRedo(old=>old.slice(0,-1));setDirty(true);}
  function start(e:PE<HTMLElement>,field:EditableField,mode:'move'|'size'){
    if(preview||busy||!pageRef.current)return;
    e.preventDefault();e.stopPropagation();checkpoint();setSelected(field.id);
    drag.current={id:field.id,mode,startX:e.clientX,startY:e.clientY,original:{...field},width:pageRef.current.getBoundingClientRect().width};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e:PE<HTMLElement>){
    const d=drag.current;if(!d||e.currentTarget.dataset.fieldId!==d.id)return;
    const dx=(e.clientX-d.startX)*PDF_WIDTH/d.width,dy=(e.clientY-d.startY)*PDF_WIDTH/d.width;
    const r=(n:number)=>grid?Math.round(n):Math.round(n*10)/10;
    const f=d.original;
    update(d.id,d.mode==='move'?{x:r(Math.max(0,Math.min(PDF_WIDTH-f.w,f.x+dx))),y:r(Math.max(0,Math.min(PDF_HEIGHT-f.h,f.y+dy)))}:{w:r(Math.max(3,Math.min(PDF_WIDTH-f.x,f.w+dx))),h:r(Math.max(3,Math.min(PDF_HEIGHT-f.y,f.h+dy)))},false);
  }
  function add(){
    checkpoint();const id='custom_'+crypto.randomUUID().replace(/-/g,'').slice(0,22);
    setFields(old=>[...old,{id,label:'Новое поле',kind:'text',page,x:90,y:120,w:120,h:20,fontSize:12,adjusted:true}]);setSelected(id);
  }
  function remove(){
    if(!active||!confirm('Удалить поле из шаблона? Данные существующих персонажей останутся в базе.'))return;
    checkpoint();setFields(old=>old.filter(f=>f.id!==active.id));setSelected('');
  }
  async function save():Promise<boolean>{
    if(!supabase||busy)return false;
    if(!validFields(fields)){setStatus('Некорректные размеры или координаты полей.');return false;}
    setBusy(true);
    const {error}=await supabase.from('sheet_template_drafts').upsert({template_key:TEMPLATE_KEY,fields,updated_by:userId,updated_at:new Date().toISOString()},{onConflict:'template_key'});
    setBusy(false);
    if(error){setStatus(error.message);return false;}
    setDirty(false);setStatus('Черновик сохранён, опубликованный лист не изменился.');return true;
  }
  async function publish(){
    if(!supabase||!confirm('Опубликовать макет для всех пользователей PF2e?'))return;
    if(!(await save()))return;
    setBusy(true);
    const {data,error}=await supabase.rpc('publish_sheet_template',{p_template_key:TEMPLATE_KEY});
    setBusy(false);
    if(error){setStatus(error.message);return;}
    setVersion(Number(data));setVersions(old=>[Number(data),...old]);setStatus('Опубликована версия '+data+'. Оформление применено; пробные значения не переносятся в персонажей.');
  }
  async function loadVersion(){
    if(!supabase||!restore||!confirm('Загрузить выбранную версию в редактор?'))return;
    const {data,error}=await supabase.from('sheet_template_history').select('fields').eq('template_key',TEMPLATE_KEY).eq('version',Number(restore)).single();
    if(error||!validFields(data?.fields)){setStatus('Не удалось восстановить версию.');return;}
    checkpoint();setFields(cloneFields(data.fields));setSelected('');setStatus('Версия загружена в черновик. Для публикации нажми «Опубликовать».');
  }
  const box=(f:EditableField):CSSProperties=>({
    left:(f.x/PDF_WIDTH*100)+'%',top:(f.y/PDF_HEIGHT*100)+'%',
    width:(f.w/PDF_WIDTH*100)+'%',height:(f.h/PDF_HEIGHT*100)+'%',
  });
  // The editable preview uses the same HTML control and classes as the live sheet.
  // A generic span has different line-height, padding and vertical text alignment.
  const previewText=(f:EditableField)=>{
    const value=samples[f.id] ?? (f.kind==='select'?(f.options?.[0]??''):f.label);
    const narrow=f.w<40?' pf-field-narrow':'',tiny=f.w<20?' pf-field-tiny':'';
    const numeric=f.kind==='number'||f.kind==='counter';
    const className='pf-field-text'+(numeric?' pf-field-number':'')+narrow+tiny+
      (f.id==='name'?' pf-field-character-name':'')+
      (f.underline?' pf-field-underline':'');
    const style:CSSProperties={
      fontFamily:f.fontFamily||undefined,
      fontSize:f.fontSize? (100*f.fontSize/PDF_WIDTH)+'cqw':undefined,
      fontWeight:f.fontWeight||undefined,
      textAlign:f.textAlign||undefined,
      color:f.color||undefined,
      padding:f.paddingX!==undefined||f.paddingY!==undefined
        ? (100*(f.paddingY??0)/PDF_WIDTH)+'cqw '+(100*(f.paddingX??2)/PDF_WIDTH)+'cqw'
        :undefined,
    };
    if(f.kind==='toggle')return <ToggleVisual field={f} checked={samples[f.id]==='true'} editorGuide={!preview}/>;
    if(f.kind==='long')return <textarea aria-label={f.label} readOnly tabIndex={-1}
      className={'ta-preview-control '+className+' pf-field-long'} style={style} value={value}/>;
    if(f.kind==='select')return <select aria-label={f.label} tabIndex={-1}
      className={'ta-preview-control '+className+' pf-field-select'} style={style} value={value} onChange={()=>{}}>
      {value&&!f.options?.includes(value)&&<option value={value}>{value}</option>}
      {(f.options??[]).map(option=><option key={option} value={option}>{option}</option>)}
    </select>;
    return <input aria-label={f.label} tabIndex={-1} readOnly
      className={'ta-preview-control '+className} style={style} value={value}/>;
  };
  const prop=(key:keyof EditableField,value:string|number)=>active&&update(active.id,{[key]:value});
  return <main className="page ta-editor">
    <div className="ta-top">
      <button onClick={()=>{if(!dirty||confirm('Выйти без сохранения изменений?'))onClose();}}>← К персонажам</button>
      <h1>Редактор листа PF2e</h1>
      <button disabled={loading||busy} onClick={()=>void save()}>Сохранить черновик</button>
      <button className="ta-publish" disabled={loading||busy} onClick={()=>void publish()}>Опубликовать</button>
    </div>
    <p className="ta-status" role="status">{status}{dirty?' · Не сохранено':''}</p>
    <div className="ta-controls">
      {PAGE_NAMES.map((title,i)=><button key={title} className={page===i+1?'active':''} onClick={()=>{setPage(i+1);setSelected('');}}>{i+1}. {title}</button>)}
      <button disabled={!undo.length} onClick={undoOnce}>↶ Отмена</button>
      <button disabled={!redo.length} onClick={redoOnce}>↷ Повтор</button>
      <button onClick={()=>setPreview(!preview)}>{preview?'Правка':'Предпросмотр'}</button>
      <label>Масштаб<input type="range" min="600" max="1100" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
      <label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/>Привязка 1pt</label>
    </div>
    <div className="ta-columns">
      <div className="ta-scroll"><div className="ta-page" ref={pageRef} style={{width:zoom,aspectRatio:PDF_WIDTH+'/'+PDF_HEIGHT}}>
        <img src={import.meta.env.BASE_URL+'pathfinder/page-'+page+'.webp?v=3'} alt={'Страница '+page} draggable={false}/>
        {fields.filter(f=>f.page===page).map(f=><div key={f.id} data-field-id={f.id} title={f.label+' ('+f.id+')'}
          className={'ta-field '+(selected===f.id?'selected ':'')+(preview?'preview':'')+(samples[f.id]!==undefined?' ta-with-sample':'')+(f.kind==='long'?' ta-multiline':'')+(f.kind!=='toggle'&&f.underline?' ta-has-underline':'')}
          style={box(f)} onPointerDown={e=>start(e,f,'move')} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onClick={()=>setSelected(f.id)}>
          {previewText(f)}
          {!preview&&selected===f.id&&<span className="ta-handle" onPointerDown={e=>start(e,f,'size')}/>}
        </div>)}
      </div></div>
      <aside className="ta-side">
        <div className="ta-row"><strong>Поля: {fields.filter(f=>f.page===page).length}</strong><button onClick={add}>+ Добавить</button></div>
        <label>Выбрать поле<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">— Не выбрано —</option>{fields.filter(f=>f.page===page).map(f=><option key={f.id} value={f.id}>{f.label} / {f.id}</option>)}</select></label>
        {active?<div className="ta-form">
          <small>ID: {active.id}</small>
          {active.kind==='toggle'
            ? <label className="ta-toggle-setting"><input type="checkbox"
                checked={samples[active.id]==='true'}
                onChange={e=>setSamples(old=>({...old,[active.id]:e.target.checked?'true':'false'}))}/>
                Пробное нажатие (не сохраняется)</label>
            : active.kind==='select'
            ? <label>Пример только для предпросмотра<select value={samples[active.id]??''} onChange={e=>setSamples(old=>({...old,[active.id]:e.target.value}))}>
                <option value="">— Выбери вариант —</option>
                {(active.options??[]).map(value=><option key={value} value={value}>{value}</option>)}
              </select></label>
            : <label>Пример только для предпросмотра<textarea className="ta-sample-input" rows={3} placeholder="Введи текст для проверки на листе" value={samples[active.id]??''} onChange={e=>setSamples(old=>({...old,[active.id]:e.target.value}))}/></label>}
          <p className="ta-sample-notice">Пробное значение <strong>не публикуется</strong>. В обычном листе останутся настоящие данные персонажа.</p>
          <button type="button" className="ta-clear-sample" disabled={samples[active.id]===undefined} onClick={()=>setSamples(old=>{const next={...old};delete next[active.id];return next;})}>Очистить пробное значение</button>
          <label>Название<input value={active.label} maxLength={160} onChange={e=>prop('label',e.target.value)}/></label>
          <label>Тип<select value={active.kind} onChange={e=>{
            const kind=e.target.value;
            update(active.id,kind==='select'?{kind,options:active.options?.length?active.options:(active.id==='size'?[...PF2E_SIZE_OPTIONS]:[...DEFAULT_SELECT_OPTIONS])}:{kind:kind as EditableField['kind']});
          }}><option value="text">Текст</option><option value="long">Многострочный текст</option><option value="number">Число</option><option value="counter">Счётчик</option><option value="toggle">Отметка</option><option value="select">Выпадающее меню</option></select></label>
          {active.kind==='select'&&<label>Варианты меню (по одному на строку)
            <textarea className="ta-sample-input" rows={6} maxLength={6500} placeholder={'Крошечный\nМаленький\nСредний'}
              value={(active.options??[]).join('\n')} onChange={e=>update(active.id,{options:parseOptions(e.target.value)})}/>
            <small>От 1 до 60 уникальных вариантов, до 100 символов каждый. Публикация не меняет уже сохранённые значения персонажей.</small>
          </label>}
          {active.kind==='toggle' && <>
            <label>Форма нажимной кнопки
              <select value={toggleAppearance(active).shape}
                onChange={e=>update(active.id,{toggleShape:e.target.value as EditableField['toggleShape']})}>
                <option value="square">Квадрат</option>
                <option value="rectangle">Прямоугольник</option>
                <option value="circle">Круг</option>
                <option value="diamond">Ромб</option>
                <option value="hexagon">Шестиугольник</option>
              </select>
            </label>
            <label>Вид нажатия
              <select value={toggleAppearance(active).mode}
                onChange={e=>update(active.id,{toggleMode:e.target.value as EditableField['toggleMode']})}>
                <option value="fill">Закрасить фигуру</option>
                <option value="check">Поставить галочку</option>
              </select>
            </label>
            <div className="ta-cols2">
              <label>Отступ внутри X, %<input type="number" min="0" max="40" step="1"
                value={toggleAppearance(active).insetX}
                onChange={e=>update(active.id,{toggleInsetX:Number(e.target.value)})}/></label>
              <label>Отступ внутри Y, %<input type="number" min="0" max="40" step="1"
                value={toggleAppearance(active).insetY}
                onChange={e=>update(active.id,{toggleInsetY:Number(e.target.value)})}/></label>
            </div>
            <small>Перемещай кнопку по PDF мышью и меняй W/H за угол. В предпросмотре подсветка выключена; пример нажатия задаётся выше. Для круга и квадрата выбери одинаковые W и H.</small>
            <div className="ta-toggle-sizes">
              <span>Быстрый размер:</span>
              {[7,10,15,20].map(n=><button key={n} type="button" onClick={()=>{
                const x=Math.max(0,Math.min(PDF_WIDTH-n,active.x+(active.w-n)/2));
                const y=Math.max(0,Math.min(PDF_HEIGHT-n,active.y+(active.h-n)/2));
                update(active.id,{x:Math.round(x*10)/10,y:Math.round(y*10)/10,w:n,h:n});
              }}>{n} × {n}</button>)}
            </div>
          </>}
          <div className="ta-cols4">{(['x','y','w','h'] as const).map(k=><label key={k}>{k.toUpperCase()}<input type="number" step=".5" value={active[k]} onChange={e=>prop(k,Number(e.target.value))}/></label>)}</div>
          <label>Шрифт<select value={active.fontFamily||'Arial'} onChange={e=>prop('fontFamily',e.target.value)}>{['Arial','Georgia','Verdana','Times New Roman','Courier New'].map(font=><option key={font}>{font}</option>)}</select></label>
          <div className="ta-cols2"><label>Размер (pt)<input type="number" min="5" max="40" step=".5" value={active.fontSize??12} onChange={e=>prop('fontSize',Number(e.target.value))}/></label><label>Жирность<select value={active.fontWeight??500} onChange={e=>prop('fontWeight',Number(e.target.value))}>{[400,500,600,700,800].map(w=><option key={w} value={w}>{w}</option>)}</select></label></div>
          <div className="ta-cols2"><label>Выравнивание<select value={active.textAlign||'left'} onChange={e=>prop('textAlign',e.target.value)}><option value="left">Слева</option><option value="center">Центр</option><option value="right">Справа</option></select></label><label>Цвет<input type="color" value={active.color||'#303030'} onChange={e=>prop('color',e.target.value)}/></label></div>
          <div className="ta-cols2"><label>Отступ X<input type="number" min="0" max="20" value={active.paddingX??2} onChange={e=>prop('paddingX',Number(e.target.value))}/></label><label>Отступ Y<input type="number" min="0" max="20" value={active.paddingY??0} onChange={e=>prop('paddingY',Number(e.target.value))}/></label></div>
          {active.kind!=='toggle'&&<label className="ta-underline-setting"><input type="checkbox" checked={active.underline===true} onChange={e=>update(active.id,{underline:e.target.checked})}/> Показывать нижнюю линию, даже без текста</label>}
          <button className="ta-delete" onClick={remove}>Удалить поле</button>
        </div>:<p>Нажми на поле на PDF, чтобы выделить его. Перетаскивай для перемещения, потяни за синий угол для изменения размера.</p>}
        <hr/>
        <strong>История шаблона</strong>
        <p>Опубликованная версия: {version||'нет'}. Черновик виден только администратору.</p>
        <div className="ta-row"><select value={restore} onChange={e=>setRestore(e.target.value)}><option value="">Выбери версию</option>{versions.map(v=><option key={v} value={v}>Версия {v}</option>)}</select><button disabled={!restore} onClick={()=>void loadVersion()}>Загрузить</button></div>
        <button onClick={()=>{if(confirm('Сбросить к исходной разметке?')){checkpoint();setFields(cloneFields(DEFAULT_FIELDS));setSelected('');}}}>Вернуть исходную разметку</button>
      </aside>
    </div>
  </main>;
}
