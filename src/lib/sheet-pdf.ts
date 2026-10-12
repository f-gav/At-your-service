/**
 * Export the actual completed HTML sheets to a downloadable A4 PDF.
 * The game data is never modified. Portraits, original Pathfinder art, and
 * user-entered fields are captured from the same markup players see.
 *
 * Extra Project Moon weapons/skills live in a carousel / extendable list;
 * they are moved to their own PDF pages instead of being clipped or omitted.
 */
export type PdfSystem = 'pf2e' | 'prmoon';

export const PDF_A4 = {width:210,height:297} as const;
export const EXTRA_CARDS_PER_PAGE = 4;
export function exportPagePlan(system:PdfSystem,basePages:number,weapons=2,skills=6){
  const extraWeapons=system==='prmoon'?Math.max(0,weapons-2):0;
  const extraSkills=system==='prmoon'?Math.max(0,skills-6):0;
  return {
    basePages,
    extraWeapons,
    extraSkills,
    extraPages:Math.ceil(extraWeapons/EXTRA_CARDS_PER_PAGE)+Math.ceil(extraSkills/EXTRA_CARDS_PER_PAGE),
  };
}

function mirrorFormValues(original:Element,copy:Element){
  const source=original.querySelectorAll('input,textarea,select');
  const dest=copy.querySelectorAll('input,textarea,select');
  source.forEach((field,index)=>{
    const cloned=dest[index];
    if(field instanceof HTMLInputElement && cloned instanceof HTMLInputElement){
      cloned.value=field.value;
      cloned.checked=field.checked;
      cloned.setAttribute('value',field.value);
      if(field.checked)cloned.setAttribute('checked',''); else cloned.removeAttribute('checked');
    }else if(field instanceof HTMLTextAreaElement && cloned instanceof HTMLTextAreaElement){
      cloned.value=field.value;
      cloned.textContent=field.value;
    }else if(field instanceof HTMLSelectElement && cloned instanceof HTMLSelectElement){
      cloned.value=field.value;
    }
  });
}

function duplicateForExport(original:HTMLElement):HTMLElement{
  const copy=original.cloneNode(true) as HTMLElement;
  mirrorFormValues(original,copy);
  copy.querySelectorAll<HTMLImageElement>('img').forEach(image=>{
    image.loading='eager';
    image.decoding='sync';
  });
  return copy;
}

async function awaitImages(parent:HTMLElement){
  const images=Array.from(parent.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(img=>{
    if(img.complete)return Promise.resolve();
    return new Promise<void>(resolve=>{
      img.addEventListener('load',()=>resolve(),{once:true});
      img.addEventListener('error',()=>resolve(),{once:true});
    });
  }));
}

function prepareMoonCombat(page:HTMLElement){
  page.querySelectorAll('.moon-weapon-card').forEach((card,index)=>{
    if(index>=2)card.remove(); else card.removeAttribute('inert');
  });
  page.querySelectorAll('.moon-skill-card').forEach((card,index)=>{
    if(index>=6)card.remove();
  });
  const carousel=page.querySelector<HTMLElement>('.moon-weapon-carousel');
  if(carousel)carousel.scrollLeft=0;
}

function cloneSupplementCards(nodes:HTMLElement[]):HTMLElement[]{
  return nodes.map(node=>{
    const copy=duplicateForExport(node);
    copy.removeAttribute('inert');
    copy.querySelectorAll('button').forEach(button=>button.remove());
    return copy;
  });
}

function appendSupplementPages(stage:HTMLElement,heading:string,nodes:HTMLElement[]){
  for(let i=0;i<nodes.length;i+=EXTRA_CARDS_PER_PAGE){
    const page=document.createElement('article');
    page.className='moon-paper moon-pdf-supplement';
    page.setAttribute('aria-label',heading);
    const header=document.createElement('header');
    header.className='moon-page-heading';
    const brand=document.createElement('span');
    brand.textContent='PROJECT MOON';
    const title=document.createElement('h2');
    title.textContent=heading;
    header.append(brand,title);
    const section=document.createElement('section');
    section.className='moon-section';
    const grid=document.createElement('div');
    grid.className='moon-two-columns moon-pdf-extra-grid';
    grid.append(...cloneSupplementCards(nodes.slice(i,i+EXTRA_CARDS_PER_PAGE)));
    section.append(grid);
    page.append(header,section);
    stage.append(page);
  }
}

function safeFileName(name:string,system:PdfSystem){
  const safe=name.replace(/[\\/:*?"<>|\\x00-\\x1f]/g,' ').trim().slice(0,80)||'Персонаж';
  return `${system==='pf2e'?'PF2e':'PrMoon'}_${safe}.pdf`;
}

export async function exportRenderedSheetPdf(root:HTMLElement,name:string,system:PdfSystem):Promise<number>{
  const original=Array.from(root.querySelectorAll<HTMLElement>(system==='pf2e'?'.pf-sheet-stack > .pf-sheet-page':'.moon-sheet-scroll > .moon-paper'));
  if(original.length<4)throw new Error('Не найдены все страницы листа для экспорта PDF.');
  const stage=document.createElement('div');
  stage.className=(system==='pf2e'?'page pf-editor':'page moon-editor')+' sheet-pdf-stage';
  stage.setAttribute('aria-hidden','true');
  // The current layout custom properties must be inherited by staged pages.
  stage.style.cssText=root.getAttribute('style')||'';
  stage.style.position='absolute';
  stage.style.left='-20000px';
  stage.style.top='0';
  stage.style.zIndex='-1';
  stage.style.pointerEvents='none';
  stage.style.width=system==='pf2e'?'960px':'980px';

  const stack=document.createElement('div');
  stack.className=system==='pf2e'?'pf-sheet-stack':'moon-sheet-scroll';
  if(system==='pf2e')stack.style.width='960px';
  for(const oldPage of original){
    const page=duplicateForExport(oldPage);
    if(system==='prmoon'){
      prepareMoonCombat(page);
      page.style.width='210mm';
    }
    stack.append(page);
  }
  stage.append(stack);
  if(system==='prmoon'){
    const weapons=Array.from(root.querySelectorAll<HTMLElement>('.moon-weapon-card')).slice(2);
    const skills=Array.from(root.querySelectorAll<HTMLElement>('.moon-skill-card')).slice(6);
    if(weapons.length)appendSupplementPages(stack,'Дополнительное оружие',weapons);
    if(skills.length)appendSupplementPages(stack,'Дополнительные приёмы',skills);
  }
  document.body.append(stage);
  try {
    await document.fonts.ready;
    await awaitImages(stage);
    // The source paper uses min-height:A4, but long rich-text pages may overflow.
    // Expand the capture boundary to preserve that content rather than crop it.
    for(const page of Array.from(stack.children) as HTMLElement[]){
      const fullHeight=Math.max(page.scrollHeight,page.offsetHeight);
      if(fullHeight>page.offsetHeight)page.style.height=fullHeight+'px';
    }
    // Import on demand; home screen never downloads the PDF rendering engines.
    const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    let total=0;
    for(const page of Array.from(stack.children) as HTMLElement[]){
      // Long lists/content can exceed an A4 height: split rather than crop.
      const canvas=await html2canvas(page,{
        backgroundColor:'#ffffff',scale:2,useCORS:true,allowTaint:false,
        logging:false, imageTimeout:20000,
        scrollX:0,scrollY:0,
      });
      const pageHeight=Math.round(canvas.width*PDF_A4.height/PDF_A4.width);
      for(let y=0;y<canvas.height;y+=pageHeight){
        const fragment=document.createElement('canvas');
        fragment.width=canvas.width;
        fragment.height=pageHeight;
        const ctx=fragment.getContext('2d');
        if(!ctx)throw new Error('Не удалось подготовить страницу PDF.');
        ctx.fillStyle='#ffffff';ctx.fillRect(0,0,fragment.width,fragment.height);
        ctx.drawImage(canvas,0,y,canvas.width,Math.min(pageHeight,canvas.height-y),
          0,0,canvas.width,Math.min(pageHeight,canvas.height-y));
        if(total>0)pdf.addPage('a4','portrait');
        pdf.addImage(fragment.toDataURL('image/jpeg',.93),'JPEG',0,0,PDF_A4.width,PDF_A4.height,undefined,'FAST');
        total++;
        // Don't retain all large page canvases in memory.
        fragment.width=0;fragment.height=0;
      }
      canvas.width=0;canvas.height=0;
    }
    pdf.save(safeFileName(name,system));
    return total;
  }finally{
    stage.remove();
  }
}
