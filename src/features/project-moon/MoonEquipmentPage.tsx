import {useEffect,useRef,useState} from 'react';
import type {Dispatch,ReactNode,SetStateAction} from 'react';
import {ChevronLeft,ChevronRight,Plus,X} from 'lucide-react';
import RichField from '../pathfinder/RichField';
import {MOON_AUGMENT_TYPES,moonAugmentTypeLabel,moonAugmentTypeValue} from './augment-types';
import MoonWeaponDeleteDialog from './MoonWeaponDeleteDialog';
import type {MoonAugment,MoonOutfit,MoonSheetData} from './model';
import {
  addMoonOutfit,addMoonAugment,removeMoonOutfit,removeMoonAugment,
  updateMoonOutfit,updateMoonAugment,moonAugmentEpSummary,moonWeaponLetter,
} from './model';

type Card={id:string;name:string};
type CarouselProps<T extends Card>={
  kind:'outfit'|'augment';title:string;items:T[];disabled:boolean;
  smooth:boolean;onAdd:()=>void;onDelete:(item:T)=>void;
  render:(item:T,index:number)=>ReactNode;
};
/** Two square-ish cards on desktop, one on mobile, just like the weapon carousel. */
function EquipmentCarousel<T extends Card>({kind,title,items,disabled,smooth,onAdd,onDelete,render}:CarouselProps<T>){
  const [offset,setOffset]=useState(0);
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width:660px)').matches);
  const viewport=useRef<HTMLDivElement>(null);
  const visible=compact?1:2;
  const max=Math.max(0,items.length-visible);
  useEffect(()=>{
    const query=window.matchMedia('(max-width:660px)');
    const update=()=>setCompact(query.matches);
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>setOffset(old=>Math.min(old,max)),[max]);
  useEffect(()=>{
    const cards=viewport.current?.querySelectorAll<HTMLElement>('.moon-equipment-card');
    if(!cards?.length||!viewport.current)return;
    const first=cards[0].offsetLeft;
    const target=cards[Math.min(offset,cards.length-1)].offsetLeft-first;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.current.scrollTo({left:target,behavior:smooth&&!reducedMotion?'smooth':'instant'});
  },[offset,compact,items.length,smooth]);
  const next=()=>{onAdd();setOffset(Math.max(0,items.length+1-visible));};
  const selected=items[Math.min(offset+visible-1,items.length-1)];
  return <section className="moon-section moon-equipment-section">
    <div className="moon-weapon-section-heading">
      <h3 className="moon-section-title">{title}</h3>
      <div className="moon-weapon-pagination moon-equipment-pagination" role="group" aria-label={'Переключение: '+title}>
        <button type="button" disabled={offset===0} aria-label={'Предыдущая '+title.toLowerCase()}
          onClick={()=>setOffset(old=>Math.max(0,old-1))}><ChevronLeft size={17}/></button>
        <span aria-live="polite">{moonWeaponLetter(offset)}–{moonWeaponLetter(Math.min(offset+visible-1,items.length-1))}
          <small> / {items.length}</small></span>
        <button type="button" disabled={offset>=max} aria-label={'Следующая '+title.toLowerCase()}
          onClick={()=>setOffset(old=>Math.min(max,old+1))}><ChevronRight size={17}/></button>
        <button type="button" aria-label={'Добавить '+(kind==='outfit'?'броню':'аугмент')}
          disabled={disabled||items.length>=100} onClick={next}><Plus size={16}/></button>
        <button type="button" aria-label={'Удалить '+(kind==='outfit'?'броню':'аугмент')}
          disabled={disabled||items.length<=1||!selected} onClick={()=>selected&&onDelete(selected)}>
          <X size={16}/></button>
      </div>
    </div>
    <div className="moon-equipment-carousel" ref={viewport} aria-label={'Карточки: '+title}>
      <div className="moon-equipment-track">
        {items.map((item,index)=><div key={item.id}
          className={'moon-card moon-equipment-card moon-'+kind+'-card'}
          inert={index<offset||index>=offset+visible}
          aria-label={title+' '+moonWeaponLetter(index)}>
          {render(item,index)}
        </div>)}
      </div>
    </div>
  </section>;
}
const damageTypes=[
  {key:'Slash',label:'Режущий'},
  {key:'Pierce',label:'Колющий'},
  {key:'Blunt',label:'Дробящий'},
] as const;
export default function MoonEquipmentPage({sheet,setSheet,disabled}:{
  sheet:MoonSheetData;
  setSheet:Dispatch<SetStateAction<MoonSheetData>>;
  disabled:boolean;
}){
  const [pending,setPending]=useState<{kind:'outfit'|'augment';id:string;label:string}|null>(null);
  const updateOutfit=(id:string,patch:Partial<MoonOutfit>)=>setSheet(old=>updateMoonOutfit(old,id,patch));
  const updateAugment=(id:string,patch:Partial<MoonAugment>)=>setSheet(old=>updateMoonAugment(old,id,patch));
  const ep=moonAugmentEpSummary(sheet);
  const confirm=()=>{
    if(!pending||disabled)return;
    setSheet(old=>pending.kind==='outfit'?removeMoonOutfit(old,pending.id):removeMoonAugment(old,pending.id));
    setPending(null);
  };
  return <div className="moon-equipment-page">
    <EquipmentCarousel kind="outfit" title="Броня" items={sheet.outfits}
      disabled={disabled} smooth={sheet.smoothWeaponSwitch}
      onAdd={()=>setSheet(old=>addMoonOutfit(old,'outfit-'+crypto.randomUUID()))}
      onDelete={item=>setPending({kind:'outfit',id:item.id,label:'броню «'+(item.name||'без названия')+'»'})}
      render={(item,index)=><>
        <div className="moon-card-heading moon-equipment-card-heading">
          <input className="moon-weapon-title" type="text" disabled={disabled} maxLength={160}
            aria-label={'Название брони '+(index+1)} placeholder={'БРОНЯ '+moonWeaponLetter(index)}
            value={item.name} onChange={e=>updateOutfit(item.id,{name:e.target.value})}/>
          <label className="moon-outfit-equipped">
            <input type="checkbox" disabled={disabled} aria-label={'Надета броня '+(index+1)}
              checked={sheet.equippedOutfitId===item.id}
              onChange={e=>setSheet(old=>({...old,equippedOutfitId:e.target.checked?item.id:''}))}/>
            Надето
          </label>
        </div>
        <div className="moon-equipment-fields moon-equipment-fields-three">
          <label>Ранг <input disabled={disabled} aria-label={'Ранг брони '+(index+1)} value={item.rank}
            onChange={e=>updateOutfit(item.id,{rank:e.target.value})}/></label>
          <label>EP <input disabled={disabled} aria-label={'EP брони '+(index+1)} value={item.ep}
            onChange={e=>updateOutfit(item.id,{ep:e.target.value})}/></label>
          <label>Свойство
            <select disabled={disabled} value={item.property} aria-label={'Свойство брони '+(index+1)}
              onChange={e=>updateOutfit(item.id,{property:e.target.value})}>
              <option value="">—</option><option value="Armored">Бронированная</option>
              <option value="Swift">Проворная</option><option value="Balanced">Сбалансированная</option>
            </select>
          </label>
        </div>
        <div className="moon-equipment-fields">
          <label>Блок <input disabled={disabled} aria-label={'Блок брони '+(index+1)}
            placeholder="1d10+0" value={item.block} onChange={e=>updateOutfit(item.id,{block:e.target.value})}/></label>
          <label>Уклонение <input disabled={disabled} aria-label={'Уклонение брони '+(index+1)}
            placeholder="1d12+0" value={item.evade} onChange={e=>updateOutfit(item.id,{evade:e.target.value})}/></label>
        </div>
        <table className="moon-equipment-resistances">
          <thead><tr><th>Сопротивление</th><th>HP</th><th>ST</th></tr></thead>
          <tbody>{damageTypes.map(({key,label})=>{
            const hp=('hp'+key) as 'hpSlash'|'hpPierce'|'hpBlunt';
            const st=('st'+key) as 'stSlash'|'stPierce'|'stBlunt';
            return <tr key={key}><th>{label}</th>
              <td><input disabled={disabled} value={item[hp]} placeholder="×1"
                aria-label={label+' HP брони '+(index+1)}
                onChange={e=>updateOutfit(item.id,{[hp]:e.target.value})}/></td>
              <td><input disabled={disabled} value={item[st]} placeholder="×1"
                aria-label={label+' ST брони '+(index+1)}
                onChange={e=>updateOutfit(item.id,{[st]:e.target.value})}/></td>
            </tr>;
          })}</tbody>
        </table>
        <div className="moon-rich-group"><span>ЭФФЕКТЫ / УСЛОВИЯ</span>
          <RichField id={'moon-outfit-'+item.id} label={'Эффекты брони '+(index+1)}
            value={item.effects} onChange={value=>updateOutfit(item.id,{effects:value})}
            disabled={disabled} grow placeholder="Эффекты и особые условия брони…"/>
        </div>
      </>}/>
    <section className="moon-section moon-equipment-ep-section">
      <div className="moon-equipment-ep" role="status">
        <strong>EP аугментов</strong>
        <span>База: {ep.base===null?'—':ep.base}</span>
        <span>Положительные: {ep.spent}</span>
        <span>Отрицательные: {ep.gained}</span>
        <span>Осталось: {ep.remaining===null?'—':ep.remaining}</span>
      </div>
      <p className="moon-equipment-hint">Общий бюджет рассчитывается по рангу персонажа. Поля не меняют ресурсы и сопротивления автоматически.</p>
    </section>
    <EquipmentCarousel kind="augment" title="Аугменты" items={sheet.augments}
      disabled={disabled} smooth={sheet.smoothWeaponSwitch}
      onAdd={()=>setSheet(old=>addMoonAugment(old,'augment-'+crypto.randomUUID()))}
      onDelete={item=>setPending({kind:'augment',id:item.id,label:'аугмент «'+(item.name||'без названия')+'»'})}
      render={(item,index)=><>
        <div className="moon-card-heading moon-equipment-card-heading">
          <input type="text" className="moon-weapon-title" maxLength={160} disabled={disabled}
            value={item.name} placeholder={'АУГМЕНТ '+moonWeaponLetter(index)}
            aria-label={'Название аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{name:e.target.value})}/>
        </div>
        <div className="moon-equipment-fields moon-equipment-fields-three">
          <label>Тип <input disabled={disabled} value={moonAugmentTypeLabel(item.category)} list="moon-augment-types"
            aria-label={'Тип аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{category:moonAugmentTypeValue(e.target.value)})}/></label>
          <label>Часть тела / источник <input disabled={disabled} value={item.location}
            aria-label={'Часть тела аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{location:e.target.value})}/></label>
          <label>Ранг <input disabled={disabled} value={item.rank}
            aria-label={'Ранг аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{rank:e.target.value})}/></label>
        </div>
        <div className="moon-equipment-fields">
          <label>Положительные EP <input disabled={disabled} inputMode="numeric" value={item.positiveEp}
            aria-label={'Положительные EP аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{positiveEp:e.target.value})}/></label>
          <label>Отрицательные EP <input disabled={disabled} inputMode="numeric" value={item.negativeEp}
            aria-label={'Отрицательные EP аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{negativeEp:e.target.value})}/></label>
        </div>
        <label className="moon-equipment-summary-field">Описание / внешний вид
          <input disabled={disabled} value={item.description} aria-label={'Описание аугмента '+(index+1)}
            onChange={e=>updateAugment(item.id,{description:e.target.value})}/>
        </label>
        <div className="moon-rich-group"><span>ЭФФЕКТЫ</span>
          <RichField id={'moon-augment-effects-'+item.id} label={'Эффекты аугмента '+(index+1)}
            value={item.effects} onChange={value=>updateAugment(item.id,{effects:value})}
            disabled={disabled} grow placeholder="Положительные эффекты…"/>
        </div>
        <div className="moon-rich-group"><span>НЕДОСТАТКИ</span>
          <RichField id={'moon-augment-drawbacks-'+item.id} label={'Недостатки аугмента '+(index+1)}
            value={item.drawbacks} onChange={value=>updateAugment(item.id,{drawbacks:value})}
            disabled={disabled} grow placeholder="Отрицательные эффекты…"/>
        </div>
      </>}/>
    <datalist id="moon-augment-types">
      {MOON_AUGMENT_TYPES.map(type=><option key={type.value} value={type.label}/>)}
    </datalist>
    {pending&&<MoonWeaponDeleteDialog kind={pending.kind} label={pending.label}
      disabled={disabled} onCancel={()=>setPending(null)} onConfirm={confirm}/>}
  </div>;
}
