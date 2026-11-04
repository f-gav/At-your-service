import type {DndBonus} from './model.ts';
export type BonusTrace={source:string;op:DndBonus['op'];value:number;priority:number};
export type BonusTotal={value:number;advantage:-1|0|1;trace:BonusTrace[]};
function ordered(bonuses:readonly DndBonus[],target:string):DndBonus[]{
  return bonuses.filter(b=>b.active!==false&&b.target===target).sort((a,b)=>(a.priority??0)-(b.priority??0)||a.id.localeCompare(b.id));
}
/** Explicit layers: base choice -> additives -> multipliers -> clamps -> final override. */
export function applyDndBonuses(base:number,target:string,bonuses:readonly DndBonus[]):BonusTotal {
  if(!Number.isFinite(base))throw Error('D&D: исходное значение не число');
  const entries=ordered(bonuses,target), trace:BonusTrace[]=[];
  let result=base,adv=0,dis=0;
  const layer=(op:DndBonus['op'])=>entries.filter(b=>b.op===op);
  const apply=(b:DndBonus)=>{
    const v=b.value??0;
    if(!Number.isFinite(v)||Math.abs(v)>100000)throw Error('D&D: неверный бонус '+b.id);
    trace.push({source:b.source,op:b.op,value:v,priority:b.priority??0});
    return v;
  };
  for(const b of layer('base'))result=apply(b);
  for(const b of layer('add'))result+=apply(b);
  for(const b of layer('multiply'))result*=apply(b);
  for(const b of layer('min'))result=Math.max(result,apply(b));
  for(const b of layer('max'))result=Math.min(result,apply(b));
  for(const b of layer('override'))result=apply(b);
  for(const b of layer('advantage')){apply(b);adv++;}
  for(const b of layer('disadvantage')){apply(b);dis++;}
  if(!Number.isFinite(result))throw Error('D&D: переполнение вычислений');
  return {value:result,advantage:adv&&dis?0:adv?1:dis?-1:0,trace};
}
export function mergeAdvantage(...values:(-1|0|1)[]):-1|0|1{
  const a=values.includes(1),d=values.includes(-1);
  return a&&d?0:a?1:d?-1:0;
}
/** AYS dice engine supports kh/kl; other LSS dice modifiers remain for bundle 4. */
export function d20Formula(modifier:number,advantage:-1|0|1=0):string {
  if(!Number.isFinite(modifier)||!Number.isInteger(modifier))throw Error('D&D: неверный модификатор броска');
  const die=advantage===1?'2d20kh1':advantage===-1?'2d20kl1':'1d20';
  return die+(modifier>0?'+'+modifier:modifier<0?String(modifier):'');
}
