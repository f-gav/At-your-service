/** Only validated plain-text formula is persisted; no HTML attributes from
 * imported/user-edited documents are ever trusted or copied directly.
 */
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function diceMarkup(formula:string):string{
  const value=formula.trim().slice(0,1000);
  return '<span data-pf-dice="1" data-formula="'+escape(value)+
    '" contenteditable="false" role="button" tabindex="0" title="Бросить кубики. ПКМ — вернуть текст">'+
    escape(value)+'</span>';
}
