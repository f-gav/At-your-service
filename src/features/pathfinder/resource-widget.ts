/** Standalone, editable LSS-style resource widget.
 * Numeric values are saved on the block itself; existing simple diamond
 * resource marks retain their older, unrelated representation.
 */
export type Recovery='none'|'ten_minutes'|'daily';
export type ResourceConfig={
  name:string;
  current:number;
  max:number|null;
  recovery:Recovery;
  notes:string;
  showNotes:boolean;
};

const LIMIT=999999;
export function normalizeQuantity(value:unknown,fallback=0):number {
  if(value===null||value===undefined||String(value).trim()==='')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?Math.min(LIMIT,Math.max(0,Math.trunc(number))):fallback;
}
export function normalizeResource(data:Partial<ResourceConfig>|Record<string,unknown>):ResourceConfig {
  const rawMax=data.max;
  const max=rawMax===null||rawMax===undefined||String(rawMax).trim()===''?null:normalizeQuantity(rawMax);
  const current=Math.min(normalizeQuantity(data.current,max??0),max??LIMIT);
  const recovery=data.recovery==='ten_minutes'||data.recovery==='daily'?data.recovery:'none';
  const shown=(data as Record<string,unknown>).showNotes;
  return {
    name:String(data.name??'Ресурс').slice(0,100),
    current,max,recovery,
    notes:String(data.notes??'').slice(0,3000),
    showNotes:shown===true||shown==='1'||shown==='true',
  };
}
export function stepResource(resource:ResourceConfig,delta:number):ResourceConfig {
  const r=normalizeResource(resource);
  return {...r,current:Math.min(r.max??LIMIT,Math.max(0,r.current+Math.trunc(delta)))};
}
export function restoreResource(resource:ResourceConfig):ResourceConfig {
  const r=normalizeResource(resource);
  return r.max===null?r:{...r,current:r.max};
}
export function escapeResource(value:string):string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export const DEFAULT_RESOURCE:ResourceConfig={
  name:'Новый ресурс',current:1,max:1,recovery:'none',notes:'',showNotes:false,
};
export function resourceMarkup(raw:Partial<ResourceConfig>=DEFAULT_RESOURCE):string {
  const r=normalizeResource(raw);
  const info=r.showNotes&&r.notes.trim();
  const maxLabel=r.max===null?'∞':String(r.max);
  const e=escapeResource;
  return '<div data-pf-resource-widget="1" data-name="'+e(r.name)+
    '" data-current="'+r.current+'" data-max="'+(r.max===null?'':r.max)+
    '" data-recovery="'+r.recovery+'" data-notes="'+e(r.notes)+
    '" data-show-notes="'+(r.showNotes?'1':'0')+'" contenteditable="false" role="group">'+
    '<div class="pf-resource-row">'+
      '<span class="pf-resource-name">'+e(r.name)+'</span>'+
      '<span class="pf-resource-counter">'+
        '<span data-pf-resource-action="minus" role="button" tabindex="0" aria-label="Уменьшить ресурс">−</span>'+
        '<span class="pf-resource-count" aria-label="Количество">'+r.current+
          '<span class="pf-resource-max">'+(r.max===null?'':' / '+maxLabel)+'</span></span>'+
        '<span data-pf-resource-action="plus" role="button" tabindex="0" aria-label="Увеличить ресурс">+</span>'+
      '</span>'+
      (info?'<span data-pf-resource-action="info" role="button" tabindex="0" aria-label="Показать заметки">i</span>':'')+
      (r.max!==null?'<span data-pf-resource-action="restore" role="button" tabindex="0" aria-label="Восстановить ресурс">↺</span>':'')+
      '<span data-pf-resource-action="settings" role="button" tabindex="0" aria-label="Настройки ресурса">⚙</span>'+
    '</div>'+
    (info?'<div class="pf-resource-notes" data-pf-resource-notes-view="1">'+
      e(r.notes).replace(/\n/g,'<br>')+'</div>':'')+
    '</div>';
}
export function resourceFromElement(el:HTMLElement):ResourceConfig {
  return normalizeResource({
    name:el.dataset.name??'Новый ресурс',
    current:el.dataset.current,
    max:el.dataset.max,
    recovery:el.dataset.recovery,
    notes:el.dataset.notes??'',
    showNotes:el.dataset.showNotes==='1',
  });
}
