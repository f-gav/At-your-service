/** Project Moon augmentation categories displayed in Russian.
 * Save the original type values: older character JSON and custom text stay valid.
 */
export const MOON_AUGMENT_TYPES = [
  {value:'Биологический',label:'Биологический'},
  {value:'Протез',label:'Протез'},
  {value:'Combat Part',label:'Боевой компонент'},
  {value:'Specialized Part',label:'Специализированный компонент'},
  {value:'Functional Part',label:'Функциональный компонент'},
  {value:'Иной',label:'Иной'},
] as const;

export function moonAugmentTypeLabel(value:string):string {
  return MOON_AUGMENT_TYPES.find(type=>type.value===value)?.label??value;
}

export function moonAugmentTypeValue(label:string):string {
  return MOON_AUGMENT_TYPES.find(type=>type.label===label)?.value??label;
}
