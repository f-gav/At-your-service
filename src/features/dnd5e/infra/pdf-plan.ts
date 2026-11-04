/** Lossless TEXT pagination plan for classic D&D PDFs.
 * The four paper pages render as originals; supplementary A4 pages enumerate
 * all authored text and structured lists, including content clipped by editor
 * scroll boxes. No user data is mutated to construct the PDF.
 */
import type {Dnd5eSheet} from '../domain/model.ts';
export type DndPdfEntry={label:string;text:string};
const MAX_SEGMENT_CHARS=175;
export function splitPdfText(text:string,maxChars=MAX_SEGMENT_CHARS):string[]{
  if(!Number.isSafeInteger(maxChars)||maxChars<10||maxChars>1000)
    throw Error('D&D PDF: неверный размер текстового фрагмента');
  const points=Array.from(text);
  const chunks:string[]=[];
  for(let i=0;i<points.length;i+=maxChars)
    chunks.push(points.slice(i,i+maxChars).join(''));
  return chunks;
}
function decodeEntities(source:string){
  return source.replace(/&(?:amp|lt|gt|quot|#39|nbsp|#(\d{1,6})|#x([0-9a-fA-F]{1,6}));/g,
    (all,decimal:string|undefined,hex:string|undefined)=>{
      if(decimal||hex){
        const n=Number.parseInt(decimal||hex,decimal?10:16);
        return n>=32&&n<=0x10ffff?String.fromCodePoint(n):' ';
      }
      return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'",'&nbsp;':' '} as Record<string,string>)[all]??all;
    });
}
/** Safe plain-text view of the shared rich serializer; no untrusted HTML is
 * inserted into the export DOM. Original formatting stays on the A4 sheets.
 */
export function printableRichText(value:string):string{
  if(!value.startsWith('ays:rich:v1:'))return value;
  return decodeEntities(value.slice('ays:rich:v1:'.length)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi,'\n')
    .replace(/<[^>]*>/g,'')).replace(/\n{3,}/g,'\n\n').trim();
}
export function dndPdfEntries(sheet:Dnd5eSheet):DndPdfEntry[]{
  const entries:DndPdfEntry[]=[];
  const add=(label:string,value:string|number|undefined|null)=>{
    const text=typeof value==='number'?String(value):value??'';
    if(text.trim())entries.push({label,text});
  };
  add('Имя',sheet.identity.name);
  add('Класс',sheet.identity.className);
  add('Подкласс',sheet.identity.subclass);
  add('Происхождение / вид',sheet.identity.species);
  add('Предыстория',sheet.identity.background);
  for(const [key,value] of Object.entries(sheet.content.blocks))
    add('Текстовое поле: '+key,printableRichText(value));
  for(const a of sheet.attacks)
    add('Атака: '+a.name,[a.attackFormula,a.damageFormula,a.notes].filter(Boolean).join(' | '));
  for(const s of sheet.spellcasting.spells)
    add('Заклинание '+s.level+' круга: '+s.name,
      [s.source,s.prepared?'подготовлено':'',s.known?'известно':'',s.inBook?'в книге':'',
        s.description,s.notes].filter(Boolean).join(' | '));
  for(const r of sheet.resources??[])
    add('Ресурс: '+r.name,r.current+' / '+r.maximum+(r.formula?' · '+r.formula:''));
  for(const e of sheet.effects??[])
    add('Эффект: '+e.name,[e.condition,e.notes,e.rounds==null?'':'Раундов: '+e.rounds].filter(Boolean).join(' | '));
  for(const f of sheet.features??[])
    add('Способность: '+f.name+' ('+f.source+')',printableRichText(f.description));
  for(const c of sheet.classes??[])
    add('Класс: '+c.name,c.level+' ур.'+(c.subclass?' · '+c.subclass:''));
  for(const b of sheet.bonuses)
    add('Бонус: '+b.source,b.target+' · '+b.op+' · '+String(b.value??0));
  for(const [i,item] of sheet.inventory.items.entries())
    add('Предмет '+(i+1),JSON.stringify(item));
  for(const item of sheet.inventory.attuned)
    add('Настроенный предмет',item);
  for(const id of sheet.imports.unresolvedSpells) add('Неопознанное заклинание',id);
  return entries;
}
export function dndPdfSupplementPlan(sheet:Dnd5eSheet):{label:string;parts:string[]}[]{
  return dndPdfEntries(sheet).map(entry=>({label:entry.label,parts:splitPdfText(entry.text)}));
}
