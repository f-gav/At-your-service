/** LSS-style resource widgets, including clickable cells and safe formula maxima.
 * Formulas are parsed, never evaluated as JavaScript.
 */
export type Recovery='none'|'ten_minutes'|'daily';
export type ResourceDisplay='counter'|'cells';
export type ResourceConfig={
  name:string; current:number; max:number|null; maxFormula:string;
  display:ResourceDisplay;
  recovery:Recovery; notes:string; showNotes:boolean;
};
export type FormulaContext=Record<string,unknown>;
export type FormulaResult={value:number|null;error:string|null};
export const RESOURCE_LIMIT=999999;
export const RESOURCE_CELL_LIMIT=40;
const VARIABLE_FIELDS:Record<string,string>={
  'уровень':'level','level':'level','lvl':'level',
  'сила':'ability_str','str':'ability_str',
  'ловкость':'ability_dex','dex':'ability_dex',
  'выносливость':'ability_con','con':'ability_con',
  'интеллект':'ability_int','int':'ability_int',
  'мудрость':'ability_wis','wis':'ability_wis',
  'харизма':'ability_cha','cha':'ability_cha',
};
const VARIABLE_KEYS=Object.keys(VARIABLE_FIELDS);
const validNumber=(v:unknown):number|null=>{
  if(typeof v!=='number'&&typeof v!=='string')return null;
  const str=String(v).trim();
  if(!/^[+-]?\d+$/.test(str))return null;
  const n=Number(str);
  return Number.isSafeInteger(n)?n:null;
};
export function normalizeQuantity(value:unknown,fallback=0):number {
  if(value===null||value===undefined||String(value).trim()==='')return fallback;
  const number=Number(value);
  return Number.isFinite(number)?Math.min(RESOURCE_LIMIT,Math.max(0,Math.trunc(number))):fallback;
}
export function normalizeResource(data:Partial<ResourceConfig>|Record<string,unknown>):ResourceConfig {
  const rawMax=data.max;
  const max=rawMax===null||rawMax===undefined||String(rawMax).trim()===''?null:normalizeQuantity(rawMax);
  const current=Math.min(normalizeQuantity(data.current,max??0),String(data.maxFormula??'').trim()?RESOURCE_LIMIT:(max??RESOURCE_LIMIT));
  const shown=(data as Record<string,unknown>).showNotes;
  return {
    name:String(data.name??'Ресурс').slice(0,100),
    current,max,
    maxFormula:String(data.maxFormula??'').trim().slice(0,120),
    display:data.display==='cells'?'cells':'counter',
    recovery:data.recovery==='ten_minutes'||data.recovery==='daily'?data.recovery:'none',
    notes:String(data.notes??'').slice(0,3000),
    showNotes:shown===true||shown==='1'||shown==='true',
  };
}

/** Small expression grammar: integer constants, +, -, *, / and parentheses.
 * Variables are ONLY the character's actual level and six ability modifiers.
 * No eval, functions, member access, powers or arbitrary identifiers.
 */
export function evaluateResourceFormula(raw:string,values:FormulaContext={}):FormulaResult {
  const source=raw.trim().toLowerCase().replace(/[−–—]/g,'-');
  if(!source||source.length>120)return {value:null,error:'Укажи формулу длиной до 120 символов'};
  const tokens=source.match(/(?:\d+|[a-zа-яё_]+|[()+*/-])/gu)??[];
  if(tokens.length>100||tokens.join('').length!==source.replace(/\s+/g,'').length)
    return {value:null,error:'Формула содержит неподдерживаемые символы'};
  let cursor=0;
  class FormulaError extends Error {}
  const invalid=(message:string):never=>{throw new FormulaError(message);};
  const atom=():number=>{
    const token=tokens[cursor++];
    if(token===undefined)return invalid('Неожиданный конец формулы');
    if(token==='+')return atom();
    if(token==='-')return -atom();
    if(token==='('){const n=expression();if(tokens[cursor++]!==')')return invalid('Не закрыта скобка');return n;}
    if(/^\d+$/.test(token)){const n=Number(token);if(!Number.isSafeInteger(n))return invalid('Слишком большое число');return n;}
    const id=VARIABLE_FIELDS[token];
    if(!id)return invalid('Неизвестная переменная: '+token+'. Доступны '+VARIABLE_KEYS.filter(t=>/[а-яё]/u.test(t)).join(', '));
    const n=validNumber(values[id]);
    if(n===null)return invalid('Заполни поле «'+token+'» на листе персонажа');
    return n;
  };
  const product=():number=>{
    let n=atom();
    while(tokens[cursor]==='*'||tokens[cursor]==='/'){
      const op=tokens[cursor++],rhs=atom();
      if(op==='/'&&rhs===0)return invalid('Деление на ноль');
      n=op==='*'?n*rhs:n/rhs;
      if(!Number.isFinite(n)||Math.abs(n)>1e12)return invalid('Слишком большой результат');
    }
    return n;
  };
  const expression=():number=>{
    let n=product();
    while(tokens[cursor]==='+'||tokens[cursor]==='-'){
      const op=tokens[cursor++],rhs=product();
      n=op==='+'?n+rhs:n-rhs;
      if(!Number.isFinite(n)||Math.abs(n)>1e12)return invalid('Слишком большой результат');
    }
    return n;
  };
  try{
    const result=expression();
    if(cursor!==tokens.length)return invalid('Некорректное выражение');
    return {value:Math.min(RESOURCE_LIMIT,Math.max(0,Math.floor(result))),error:null};
  }catch(error){
    return {value:null,error:error instanceof FormulaError?error.message:'Некорректная формула'};
  }
}
export function resourceEffectiveMax(raw:Partial<ResourceConfig>,values:FormulaContext={}):FormulaResult {
  const config=normalizeResource(raw);
  if(config.maxFormula)return evaluateResourceFormula(config.maxFormula,values);
  return {value:config.max,error:null};
}
export function effectiveResource(raw:Partial<ResourceConfig>,values:FormulaContext={}):ResourceConfig {
  const r=normalizeResource(raw);
  const resolved=resourceEffectiveMax(r,values);
  return {...r,max:resolved.error?null:resolved.value,
    current:resolved.error?r.current:Math.min(r.current,resolved.value??RESOURCE_LIMIT)};
}
export function stepResource(resource:ResourceConfig,delta:number):ResourceConfig {
  const r=normalizeResource(resource);
  return {...r,current:Math.min(r.max??RESOURCE_LIMIT,Math.max(0,r.current+Math.trunc(delta)))};
}
export function restoreResource(resource:ResourceConfig):ResourceConfig {
  const r=normalizeResource(resource);
  return r.max===null?r:{...r,current:r.max};
}
/** Clicking a slot chooses that count; clicking the last filled slot empties it. */
export function chooseResourceCell(resource:ResourceConfig,index:number):ResourceConfig {
  const r=normalizeResource(resource);
  if(r.max===null||!Number.isInteger(index)||index<1||index>r.max)return r;
  return {...r,current:index===r.current?index-1:index};
}
export function escapeResource(value:string):string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export const DEFAULT_RESOURCE:ResourceConfig={
  name:'Новый ресурс',current:1,max:1,maxFormula:'',display:'counter',
  recovery:'none',notes:'',showNotes:false,
};
export function resourceMarkup(raw:Partial<ResourceConfig>=DEFAULT_RESOURCE,values:FormulaContext={}):string {
  const stored=normalizeResource(raw);
  const result=resourceEffectiveMax(stored,values);
  const effective=result.error?stored:effectiveResource(stored,values);
  const max=result.error?null:result.value;
  const e=escapeResource;
  const cells=stored.display==='cells'&&max!==null&&max>0&&max<=RESOURCE_CELL_LIMIT&&!result.error;
  const info=stored.showNotes&&stored.notes.trim();
  const widgetWarning=stored.display==='cells'&&!cells
    ?(result.error?'Формула недоступна':max===null?'Для ячеек нужен максимум':
      max>RESOURCE_CELL_LIMIT?'Больше '+RESOURCE_CELL_LIMIT+' ячеек — показано числом':'Для ячеек нужен максимум')
    :'';
  const title=result.error?result.error:widgetWarning;
  const count=effective.current;
  const maxLabel=result.error?'?':max===null?'':String(max);
  const cellMarkup=cells?
    '<span class="pf-resource-cells" role="group" aria-label="Ячейки ресурса">'+
    Array.from({length:max},(_,i)=>'<span data-pf-resource-cell="'+(i+1)+
      '" role="button" tabindex="0" aria-pressed="'+(i<count?'true':'false')+
      '" aria-label="Ресурс '+(i+1)+' из '+max+'">'+(i<count?'◆':'◇')+'</span>').join('')+'</span>'
    :'<span class="pf-resource-counter">'+
      '<span data-pf-resource-action="minus" role="button" tabindex="0" aria-label="Уменьшить ресурс">−</span>'+
      '<span class="pf-resource-count" aria-label="Количество">'+count+
        '<span class="pf-resource-max">'+(result.error?' / ?':max===null?'':' / '+maxLabel)+'</span></span>'+
      '<span data-pf-resource-action="plus" role="button" tabindex="0" aria-label="Увеличить ресурс">+</span>'+
    '</span>';
  return '<div data-pf-resource-widget="1" data-name="'+e(stored.name)+
    '" data-current="'+stored.current+'" data-max="'+(stored.max===null?'':stored.max)+
    '" data-max-formula="'+e(stored.maxFormula)+'" data-display="'+stored.display+
    '" data-recovery="'+stored.recovery+'" data-notes="'+e(stored.notes)+
    '" data-show-notes="'+(stored.showNotes?'1':'0')+'" contenteditable="false" role="group">'+
    '<div class="pf-resource-row">'+
      '<span class="pf-resource-name">'+e(stored.name)+'</span>'+
      cellMarkup+
      (title?'<span class="pf-resource-warning" title="'+e(title)+'" aria-label="'+e(title)+'">!</span>':'')+
      (info?'<span data-pf-resource-action="info" role="button" tabindex="0" aria-label="Показать заметки">i</span>':'')+
      (max!==null&&!result.error?'<span data-pf-resource-action="restore" role="button" tabindex="0" aria-label="Восстановить ресурс">↺</span>':'')+
      '<span data-pf-resource-action="settings" role="button" tabindex="0" aria-label="Настройки ресурса">⚙</span>'+
    '</div>'+
    (info?'<div class="pf-resource-notes" data-pf-resource-notes-view="1">'+
      e(stored.notes).replace(/\n/g,'<br>')+'</div>':'')+
    '</div>';
}
export function resourceFromElement(el:HTMLElement):ResourceConfig {
  return normalizeResource({
    name:el.dataset.name??'Новый ресурс',current:el.dataset.current,
    max:el.dataset.max,maxFormula:el.dataset.maxFormula??'',
    display:el.dataset.display,recovery:el.dataset.recovery,
    notes:el.dataset.notes??'',showNotes:el.dataset.showNotes==='1',
  });
}
