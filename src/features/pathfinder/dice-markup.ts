/** Safe serializable dice chip. The visible text is independent from the
 * stored expression, so changing the roll never changes the character's prose.
 * Legacy chips used the formula as their text; they remain supported.
 */
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function diceMarkup(formula:string,displayText:string=formula,safeInnerHtml?:string):string{
  const value=formula.trim().slice(0,1000);
  const label=displayText.slice(0,2000);
  return '<span data-pf-dice="1" data-formula="'+escape(value)+
    '" contenteditable="false" role="button" tabindex="0" title="Бросить: '+
    escape(value)+' (ПКМ — изменить формулу)">'+
    (safeInnerHtml===undefined?escape(label):safeInnerHtml)+'</span>';
}
