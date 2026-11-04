/** Classic D&D 2014 / 2024: 4 faithful A4 paper pages followed by
 * automatically paginated, printable supplements of ALL authored content.
 * RichField scrollports never silently crop the data: supplements are derived
 * from the canonical saved sheet, not from a truncated visible DOM snapshot.
 */
import type {Dnd5eSheet} from '../domain/model.ts';
import {dndPdfSupplementPlan} from './pdf-plan.ts';
import {PDF_A4} from '../../../lib/sheet-pdf.ts';
const MAX_PAGES=160;

function mirrorInputs(original:Element,copy:Element):void{
  const a=original.querySelectorAll('input,select,textarea');
  const b=copy.querySelectorAll('input,select,textarea');
  a.forEach((field,index)=>{
    const dst=b[index];
    if(field instanceof HTMLInputElement&&dst instanceof HTMLInputElement){
      dst.value=field.value;dst.checked=field.checked;
      dst.setAttribute('value',field.value);
      if(field.checked)dst.setAttribute('checked','');else dst.removeAttribute('checked');
    }else if(field instanceof HTMLSelectElement&&dst instanceof HTMLSelectElement){
      dst.value=field.value;
      const originalOptions=Array.from(field.options);
      Array.from(dst.options).forEach((option,i)=>{
        option.selected=originalOptions[i]?.selected??false;
      });
    }else if(field instanceof HTMLTextAreaElement&&dst instanceof HTMLTextAreaElement){
      dst.value=field.value;dst.textContent=field.value;
    }
  });
}
const element=(tag:string,className?:string)=>{
  const out=document.createElement(tag);if(className)out.className=className;return out;
};
export function safeDndPdfName(name:string,edition:string):string{
  const safe=name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,' ').trim().slice(0,72)||'Персонаж';
  return 'DnD-'+edition+'-'+safe+'.pdf';
}
/** Build a measurable, offscreen DOM stage. Caller must remove it in finally. */
export function createDndPdfStage(root:HTMLElement,sheet:Dnd5eSheet):{
  stage:HTMLElement;pages:HTMLElement[];supplementPages:number;
}{
  const originals=Array.from(root.querySelectorAll<HTMLElement>('.dnd14-paper-stack > .dnd14-paper'));
  if(originals.length!==4)throw Error('D&D PDF: не найдены все четыре страницы A4.');
  const stage=element('div','dnd-pdf-stage');
  stage.style.cssText='position:absolute;left:-24000px;top:0;width:210mm;max-width:none;'+
    'pointer-events:none;z-index:-1;background:#fff;color:#283c40;';
  document.body.append(stage);
  try {
    const pages:HTMLElement[]=[];
    for(const original of originals){
      const copy=original.cloneNode(true) as HTMLElement;
      mirrorInputs(original,copy);
      copy.style.cssText+=';width:210mm!important;height:297mm!important;'+
        'min-height:297mm!important;box-shadow:none!important;'+
        'transform:none!important;margin:0!important;break-after:auto;';
      copy.querySelectorAll<HTMLElement>('button').forEach(button=>{
        // Preserve the portrait, but not edit/add/delete controls.
        if(button.classList.contains('dnd14-portrait-button')){
          const span=element('div','dnd14-portrait-button');
          span.innerHTML=button.innerHTML;button.replaceWith(span);
        }else button.remove();
      });
      copy.querySelectorAll<HTMLElement>('[contenteditable]').forEach(node=>node.removeAttribute('contenteditable'));
      stage.append(copy);pages.push(copy);
    }
    let body:HTMLElement|null=null;
    let supplementary=0;
    const nextPage=()=>{
      if(pages.length>=MAX_PAGES)throw Error('D&D PDF: слишком много страниц. Экспорт JSON сохранит все данные.');
      const page=element('article','dnd-pdf-supplement');
      page.style.cssText='box-sizing:border-box;position:relative;width:210mm;height:297mm;'+
        'min-width:210mm;min-height:297mm;background:#fff;color:#263c45;'+
        'padding:14mm 13mm;overflow:hidden;border:0;'+
        'font:12px/1.45 Arial,"Segoe UI",sans-serif;';
      const header=element('header');
      header.style.cssText='font:bold 16px/1.2 Arial,"Segoe UI",sans-serif;'+
        'color:#234d56;border-bottom:2px solid #78989d;padding-bottom:8px;margin-bottom:8px;';
      header.textContent='D&D '+sheet.layoutEdition+' · Полное содержимое · '+sheet.identity.name;
      page.append(header);
      const content=element('div','dnd-pdf-supplement-body');
      content.style.cssText='width:100%;height:247mm;overflow:hidden;box-sizing:border-box;';
      page.append(content);
      const footer=element('div');
      footer.textContent='Приложение '+(++supplementary)+' · полный текст без обрезки';
      footer.style.cssText='position:absolute;bottom:7mm;left:13mm;color:#526b72;font-size:9px;';
      page.append(footer);
      stage.append(page);pages.push(page);
      body=content;
    };
    for(const entry of dndPdfSupplementPlan(sheet)){
      for(const [i,part] of entry.parts.entries()){
        if(!body)nextPage();
        const p=element('section');
        p.style.cssText='padding:0;margin:0 0 6px 0;break-inside:avoid;';
        const caption=element('div');
        caption.style.cssText='font:bold 11px/1.3 Arial,"Segoe UI",sans-serif;'+
          'color:#456b75;margin-bottom:2px;';
        caption.textContent=entry.label+(i?' (продолжение)':'');
        const text=element('div');
        text.style.cssText='font:12px/1.4 Arial,"Segoe UI",sans-serif;'+
          'white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;';
        text.textContent=part;
        p.append(caption,text);
        body!.append(p);
        if(body!.scrollHeight>body!.clientHeight+1){
          body!.removeChild(p);
          nextPage();
          body!.append(p);
          if(body!.scrollHeight>body!.clientHeight+1){
            throw Error('D&D PDF: текстовый фрагмент не помещается на странице — экспорт прерван без обрезки.');
          }
        }
      }
    }
    return {stage,pages,supplementPages:supplementary};
  }catch(error){
    stage.remove();throw error;
  }
}
async function waitImages(stage:HTMLElement){
  await Promise.all(Array.from(stage.querySelectorAll<HTMLImageElement>('img')).map(img=>{
    if(img.complete)return Promise.resolve();
    return new Promise<void>(resolve=>{
      img.addEventListener('load',()=>resolve(),{once:true});
      img.addEventListener('error',()=>resolve(),{once:true});
    });
  }));
}
export async function exportDndSheetPdf(root:HTMLElement,sheet:Dnd5eSheet,name:string):Promise<number>{
  const {stage,pages}=createDndPdfStage(root,sheet);
  try{
    await document.fonts.ready;
    await waitImages(stage);
    const [{default:html2canvas},{jsPDF}]=await Promise.all([
      import('html2canvas'),import('jspdf'),
    ]);
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    for(let i=0;i<pages.length;i++){
      const canvas=await html2canvas(pages[i],{
        backgroundColor:'#ffffff',scale:1.6,useCORS:true,allowTaint:false,
        logging:false,imageTimeout:14000,scrollX:0,scrollY:0,
      });
      try{
        // The paper is fixed-height. No clipping is allowed in supplements:
        // createDndPdfStage has already measured every complete paragraph.
        if(i>0)pdf.addPage('a4','portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg',.90),'JPEG',0,0,
          PDF_A4.width,PDF_A4.height,undefined,'FAST');
      }finally{canvas.width=0;canvas.height=0;}
    }
    pdf.save(safeDndPdfName(name,sheet.layoutEdition));
    return pages.length;
  }finally{stage.remove();}
}
