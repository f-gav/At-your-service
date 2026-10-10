import { useEffect,useRef,useState } from 'react';
import type { PointerEvent as PointerEvt,WheelEvent as WheelEvt } from 'react';
import { cropGeometry,frameFromCrop,optimizedSourceWebp } from './crop';
import type { CropPosition,CropSize,PortraitCrops } from './crop';
import './PortraitEditor.css';

const CARD_SIZE={width:384,height:384};
const SHEET_SIZE={width:480,height:708};
const MAX_SOURCE=3*1024*1024;
const init=():CropPosition=>({zoom:1,dx:0,dy:0});

function CropPanel({title,image,imageSize,output,crop,onChange}:{title:string;image:string;imageSize:CropSize;output:CropSize;crop:CropPosition;onChange:(value:CropPosition)=>void}) {
  const viewportRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<{x:number;y:number;initial:CropPosition}|null>(null);
  const [viewport,setViewport]=useState<CropSize>({width:220,height:220*output.height/output.width});
  useEffect(()=>{
    const node=viewportRef.current;
    if(!node)return;
    const refresh=()=>{const r=node.getBoundingClientRect();setViewport({width:r.width,height:r.height});};
    refresh();const observer=new ResizeObserver(refresh);observer.observe(node);return()=>observer.disconnect();
  },[output.height,output.width]);
  const geometry=cropGeometry(imageSize,viewport,crop);
  const onMove=(event:PointerEvt<HTMLDivElement>)=>{
    if(!dragRef.current)return;
    const d=dragRef.current;
    onChange({...crop,dx:d.initial.dx+event.clientX-d.x,dy:d.initial.dy+event.clientY-d.y});
  };
  const adjustZoom=(newZoom:number)=>{
    const z=Math.max(1,Math.min(3,newZoom));
    // Retain offsets relative to the zoom ratio when changing scale.
    onChange({...crop,zoom:z,dx:crop.dx*z/crop.zoom,dy:crop.dy*z/crop.zoom});
  };
  const onWheel=(event:WheelEvt<HTMLDivElement>)=>{
    event.preventDefault();adjustZoom(crop.zoom+(event.deltaY<0?.1:-.1));
  };
  return <div className="portrait-crop-panel">
    <strong>{title}</strong>
    <div className="portrait-crop-viewport" ref={viewportRef}
      style={{aspectRatio:output.width+'/'+output.height}}
      onPointerDown={event=>{event.preventDefault();dragRef.current={x:event.clientX,y:event.clientY,initial:{...crop}};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={onMove}
      onPointerUp={()=>{dragRef.current=null;}}
      onPointerCancel={()=>{dragRef.current=null;}}
      onWheel={onWheel} aria-label={'Обрезка изображения: '+title}>
      <img src={image} alt="Предпросмотр обрезки" draggable={false}
        style={{width:geometry.renderedWidth,height:geometry.renderedHeight,left:'calc(50% + '+geometry.dx+'px)',top:'calc(50% + '+geometry.dy+'px)',transform:'translate(-50%,-50%)'}}/>
      <div className="portrait-crop-outline" aria-hidden="true" />
    </div>
    <label className="portrait-crop-zoom">Масштаб
      <input aria-label={'Масштаб '+title} type="range" min={1} max={3} step={.025} value={crop.zoom} onChange={e=>adjustZoom(Number(e.target.value))}/>
    </label>
    <small>Перетаскивай изображение для выбора кадра</small>
  </div>;
}

export default function PortraitEditor({name,existing,onClose,onSave,onDelete}:{
  name:string;existing:boolean;onClose:()=>void;
  onSave:(source:Blob,crops:PortraitCrops)=>Promise<void>;onDelete:()=>Promise<void>;
}){
  const [imageUrl,setImageUrl]=useState('');
  const [imageSize,setImageSize]=useState<CropSize>({width:1,height:1});
  const [square,setSquare]=useState<CropPosition>(init);
  const [vertical,setVertical]=useState<CropPosition>(init);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null),imageRef=useRef<HTMLImageElement|null>(null),urlRef=useRef('');
  const squarePanel=useRef<HTMLDivElement|null>(null),verticalPanel=useRef<HTMLDivElement|null>(null);
  function dispose(){if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current='';}
  useEffect(()=>()=>dispose(),[]);
  useEffect(()=>{
    function key(event:KeyboardEvent){if(event.key==='Escape'&&!busy)onClose();}
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[busy,onClose]);
  async function openFile(file:File|undefined){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Поддерживаются JPG, PNG и WebP.');return;}
    if(file.size>MAX_SOURCE){setError('Размер исходного файла не должен превышать 3 МБ.');return;}
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{
      if(img.naturalWidth<100||img.naturalHeight<100){URL.revokeObjectURL(url);setError('Изображение слишком маленькое (минимум 100 × 100).');return;}
      dispose();urlRef.current=url;imageRef.current=img;
      setImageSize({width:img.naturalWidth,height:img.naturalHeight});setImageUrl(url);
      setSquare(init());setVertical(init());setError('');
    };
    img.onerror=()=>{URL.revokeObjectURL(url);setError('Не удалось прочитать изображение.');};
    img.src=url;
  }
  async function save(){
    const img=imageRef.current;
    if(!img||!squarePanel.current||!verticalPanel.current)return;
    setBusy(true);setError('');
    try {
      const cardBounds=squarePanel.current.querySelector('.portrait-crop-viewport')?.getBoundingClientRect();
      const sheetBounds=verticalPanel.current.querySelector('.portrait-crop-viewport')?.getBoundingClientRect();
      if(!cardBounds||!sheetBounds)throw new Error('Область обрезки недоступна.');
      const sourceSize={width:img.naturalWidth,height:img.naturalHeight};
      const crops:PortraitCrops={
        card:frameFromCrop(sourceSize,{width:cardBounds.width,height:cardBounds.height},square),
        sheet:frameFromCrop(sourceSize,{width:sheetBounds.width,height:sheetBounds.height},vertical),
      };
      const source=await optimizedSourceWebp(img);
      await onSave(source,crops);onClose();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить портрет.');}
    finally{setBusy(false);}
  }
  async function remove(){
    if(!confirm('Удалить портрет? Вместо него появится силуэт по умолчанию.'))return;
    setBusy(true);setError('');
    try{await onDelete();onClose();}catch(e){setError(e instanceof Error?e.message:'Не удалось удалить портрет.');}
    finally{setBusy(false);}
  }
  return <div className="portrait-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <section className="portrait-modal" role="dialog" aria-modal="true" aria-labelledby="portrait-title">
      <header><h2 id="portrait-title">Сменить портрет</h2><button className="portrait-close" aria-label="Закрыть" disabled={busy} onClick={onClose}>×</button></header>
      <p className="portrait-character-name">{name}</p>
      <input ref={fileRef} type="file" className="portrait-hidden-input" accept="image/jpeg,image/png,image/webp" onChange={e=>{void openFile(e.target.files?.[0]);e.target.value='';}}/>
      {!imageUrl?<div className="portrait-initial">
        <p>Максимальный размер файла: <strong>3 МБ</strong><br/>Форматы: JPG, PNG, WebP</p>
        <button className="portrait-upload" disabled={busy} onClick={()=>fileRef.current?.click()}>Загрузить изображение</button>
        {existing&&<button className="portrait-delete" disabled={busy} onClick={()=>void remove()}>Удалить текущий портрет</button>}
      </div>:<>
        <p className="portrait-hint">Выбери два кадра: квадратный для карточки и вертикальный для листа PF2e.</p>
        <div className="portrait-crop-panels">
          <div ref={squarePanel} className="portrait-crop-holder"><CropPanel title="Карточка · квадрат" image={imageUrl} imageSize={imageSize} output={CARD_SIZE} crop={square} onChange={setSquare}/></div>
          <div ref={verticalPanel} className="portrait-crop-holder"><CropPanel title="Лист · портрет" image={imageUrl} imageSize={imageSize} output={SHEET_SIZE} crop={vertical} onChange={setVertical}/></div>
        </div>
        <div className="portrait-actions"><button disabled={busy} onClick={()=>fileRef.current?.click()}>Другая картинка</button><button disabled={busy} onClick={()=>{dispose();imageRef.current=null;setImageUrl('');}}>Отмена</button><button className="portrait-save" disabled={busy} onClick={()=>void save()}>{busy?'Сохраняем…':'Сохранить'}</button></div>
      </>}
      {error&&<p className="portrait-error" role="alert">{error}</p>}
      <p className="portrait-fineprint">В облако загружается один оптимизированный WebP. Положения двух кадров сохраняются отдельно.</p>
    </section>
  </div>;
}
