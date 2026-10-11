/** Safe canonical block markup reused by the editor and HTML serializer.
 * Nested spoiler bodies stay editable; headings and title are edited in place.
 */
function escapeRichText(value:string):string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

export function dividerMarkup(title=''):string {
  return '<div data-pf-divider="1" contenteditable="false">'+
    '<span data-pf-divider-title="1" contenteditable="true" role="textbox" aria-label="Заголовок разделителя">'+
    escapeRichText(title)+'</span></div>';
}

export function spoilerMarkup(title='',body='<div><br></div>',collapsed=false):string {
  return '<div data-pf-spoiler="1" data-collapsed="'+(collapsed?'1':'0')+'" contenteditable="false">'+
    '<div data-pf-spoiler-head="1">'+
      '<span data-pf-spoiler-toggle="1" contenteditable="false" role="button" tabindex="0" aria-label="Свернуть или раскрыть спойлер">'+
        (collapsed?'▸':'▾')+'</span>'+
      '<span data-pf-spoiler-title="1" contenteditable="true" role="textbox" aria-label="Заголовок спойлера">'+escapeRichText(title)+'</span>'+
      '<span data-pf-spoiler-remove="1" contenteditable="false" role="button" tabindex="0" aria-label="Удалить спойлер">×</span>'+
    '</div><div data-pf-spoiler-body="1" contenteditable="true" role="textbox" aria-label="Содержимое спойлера">'+
    body+'</div></div>';
}
