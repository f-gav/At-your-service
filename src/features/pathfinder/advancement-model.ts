import type { FieldValue, SheetValues } from './sheet-values';

export const ADVANCEMENT_COUNT_KEY = 'advancement_level_count';
export const MAX_ADVANCEMENT_LEVEL = 20;
export const ADVANCEMENT_FIELD_IDS = new Set([
  'ancestry_features', 'ancestry_feat_1', 'background_skill_feat', 'class_features_1',
  ...Array.from({length:19},(_,i)=>'feat_level_'+(i+2)),
  ...Array.from({length:19},(_,i)=>'class_level_'+(i+2)),
]);

export const isAdvancementField = (id:string):boolean => ADVANCEMENT_FIELD_IDS.has(id);

export function advancementLevelCount(values:Record<string,FieldValue>):number {
  const raw=String(values[ADVANCEMENT_COUNT_KEY]??'');
  const count=Number(raw);
  let inferred=1;
  for(let level=2;level<=MAX_ADVANCEMENT_LEVEL;level++){
    if(String(values['feat_level_'+level]??'').trim() ||
       String(values['class_level_'+level]??'').trim()) inferred=level;
  }
  if(raw.trim() && Number.isInteger(count) && count>=1 && count<=MAX_ADVANCEMENT_LEVEL)
    return Math.max(count,inferred); // never hide older character content
  return inferred;
}

export function addAdvancementLevel(values:SheetValues):SheetValues {
  const current=advancementLevelCount(values);
  return current>=MAX_ADVANCEMENT_LEVEL?values:{
    ...values, [ADVANCEMENT_COUNT_KEY]:String(current+1),
  };
}

/** Removing any level except 1 compacts later text along with level numbers.
 * Deleted keys stay as '' until save() removes them from stored details.
 */
export function removeAdvancementLevel(values:SheetValues,level:number):SheetValues {
  const last=advancementLevelCount(values);
  if(!Number.isInteger(level)||level<=1||level>last)return values;
  const result={...values};
  for(let n=level;n<last;n++){
    result['feat_level_'+n]=String(values['feat_level_'+(n+1)]??'');
    result['class_level_'+n]=String(values['class_level_'+(n+1)]??'');
  }
  result['feat_level_'+last]='';
  result['class_level_'+last]='';
  result[ADVANCEMENT_COUNT_KEY]=String(last-1);
  return result;
}
export function ancestryHint(level:number):string {
  if(level===1)return 'Черта народа';
  if(level===5||level===9||level===13||level===17)return 'Черта народа · Повышения';
  if(level%2===1)return 'Общая черта';
  return 'Черта навыка';
}
export function classHint(level:number):string {
  return level%2===0?'Классовая черта':'Классовая особенность';
}
