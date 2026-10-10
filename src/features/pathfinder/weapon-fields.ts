import type { EditableField } from './editor-schema';
import { WEAPON_IDS } from './rules-combat';

/** Page-one PDF coordinates (pt). Art stays immutable; boxes are editable in admin. */
const ROWS = [395.16,445.15,494.10,556.83,605.78] as const;
const TYPES = [
  {suffix:'bludgeoning',name:'Дробящий (Д)',offset:1.8},
  {suffix:'piercing',name:'Колющий (К)',offset:7.15},
  {suffix:'slashing',name:'Рубящий (Р)',offset:12.5},
] as const;

export const WEAPON_SHEET_FIELDS: EditableField[] = WEAPON_IDS.flatMap((id,index)=>{
  const y=ROWS[index];
  const common={page:1,adjusted:true} as const;
  const num=(suffix:string,label:string,x:number,width=12.5):EditableField=>({
    ...common,id:'weapon_'+id+'_'+suffix,label,kind:'number',x,y:y+.1,w:width,h:11.9,
    maxlen:8,fontSize:8,textAlign:'center',paddingX:0,paddingY:0,
  });
  return [
    num('ability','Оружие '+id+': Сил / Лвк',427.5,12.1),
    num('prof','Оружие '+id+': умение',449.4,12.0),
    num('item','Оружие '+id+': предмет',468.2,12.0),
    ...TYPES.map(t=>({
      ...common,id:'weapon_'+id+'_damage_'+t.suffix,
      label:'Оружие '+id+': '+t.name,kind:'toggle' as const,
      x:565.05,y:y+t.offset,w:5.0,h:5.0,
      toggleShape:'circle' as const,toggleMode:'fill' as const,
      toggleInsetX:22,toggleInsetY:22,
    })),
  ];
});

/** Old templates place weapon_N_attack over the first STR/DEX operand,
 * not inside the printed axe/arrow. Relocate ONLY that known legacy
 * position. A field the admin already moved is respected.
 */
export function withWeaponSheetFields(fields:EditableField[]):EditableField[] {
  const corrected=fields.map(f=>{
    const match=/^weapon_([1-5])_attack$/.exec(f.id);
    if(!match)return f;
    const y=ROWS[Number(match[1])-1];
    if(f.page===1 && f.x>=425 && f.x<=442 && Math.abs(f.y-y)<=3) {
      return {...f,x:397.0,y:y-1.3,w:23.5,h:15.7,
        fontSize:f.fontSize??12,fontWeight:f.fontWeight??700,textAlign:'center' as const,
        paddingX:0,paddingY:0};
    }
    return f;
  });
  const have=new Set(corrected.map(f=>f.id));
  return [...corrected,...WEAPON_SHEET_FIELDS.filter(f=>!have.has(f.id)).map(f=>({...f}))];
}
