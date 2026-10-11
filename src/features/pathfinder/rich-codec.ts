/** Stable rich-text codec for Pathfinder long-form fields.
 *
 * Old characters store ordinary strings: they stay readable/editable unchanged.
 * New formatted content is prefixed and HTML is allow-list sanitized every
 * time it enters or leaves the editor. No executable HTML is trusted.
 */
import { dividerMarkup, spoilerMarkup } from './rich-blocks.ts';

export const RICH_PREFIX='ays:rich:v1:';

export function isRich(value:string):boolean {return value.startsWith(RICH_PREFIX);}
export function richBody(value:string):string{return isRich(value)?value.slice(RICH_PREFIX.length):value;}

export function escapeRichText(value:string):string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const KEEP=new Set(['DIV','P','BR','B','STRONG','I','EM','U','UL','LI','A','SPAN']);
/** Browser-only, because the editor itself is mounted only in the browser. */
export function sanitizeRichHtml(html:string):string {
  const doc=document.createElement('template');
  doc.innerHTML=html;
  function clean(node:Node):string {
    if(node.nodeType===Node.TEXT_NODE)return escapeRichText(node.textContent??'');
    if(node.nodeType!==Node.ELEMENT_NODE)return '';
    const el=node as HTMLElement;
    if(['SCRIPT','STYLE','SVG','IFRAME','FORM','BUTTON','INPUT','IMG'].includes(el.tagName))return '';
    // Block widgets have their own strictly reconstructed HTML. Only the
    // title (plain text), collapsed flag and sanitized body are persisted.
    // Arbitrary attributes, classes and inline handlers are never replayed.
    if(el.tagName==='DIV' && el.dataset.pfDivider==='1') {
      const title=el.querySelector<HTMLElement>(':scope > [data-pf-divider-title]');
      return dividerMarkup(title?.textContent??'');
    }
    if(el.tagName==='DIV' && el.dataset.pfSpoiler==='1') {
      const head=el.querySelector<HTMLElement>(':scope > [data-pf-spoiler-head]');
      const title=head?.querySelector<HTMLElement>('[data-pf-spoiler-title]');
      const body=el.querySelector<HTMLElement>(':scope > [data-pf-spoiler-body]');
      if(!head||!body)return Array.from(el.childNodes).map(clean).join('');
      const content=Array.from(body.childNodes).map(clean).join('') || '<div><br></div>';
      return spoilerMarkup(title?.textContent??'',content,el.dataset.collapsed==='1');
    }
    const inner=Array.from(el.childNodes).map(clean).join('');
    if(!KEEP.has(el.tagName))return inner;
    if(el.tagName==='BR')return '<br>';
    if(el.tagName==='A'){
      const href=el.getAttribute('href')??'';
      if(!/^https?:\/\//i.test(href))return inner;
      return '<a href="'+escapeRichText(href)+'" target="_blank" rel="noopener noreferrer">'+inner+'</a>';
    }
    if(el.tagName==='SPAN'){
      const resource=el.dataset.pfResource==='1';
      const task=el.dataset.pfTask==='1';
      if(resource||task){
        const filled=el.dataset.filled==='1';
        const kind=resource?'resource':'task';
        const symbol=resource?(filled?'◆':'◇'):(filled?'☑':'☐');
        return '<span data-pf-'+kind+'="1" data-filled="'+(filled?'1':'0')+
          '" contenteditable="false" role="button" tabindex="0">'+symbol+'</span>';
      }
      return inner;
    }
    const tag=el.tagName.toLowerCase();
    return '<'+tag+'>'+inner+'</'+tag+'>';
  }
  return Array.from(doc.content.childNodes).map(clean).join('');
}

/** Only mark up fields after explicit formatting. This avoids altering
 * plain strings in existing character exports until the user edits them.
 */
export function toRichHtml(value:string):string {
  if(isRich(value))return sanitizeRichHtml(richBody(value));
  if(!value)return '';
  return '<div>'+escapeRichText(value).replace(/\r?\n/g,'<br>')+'</div>';
}
export function serializeRichHtml(html:string):string {
  const safe=sanitizeRichHtml(html);
  return safe.trim()?RICH_PREFIX+safe:'';
}
