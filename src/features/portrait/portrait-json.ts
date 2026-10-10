import type { Character } from '../../lib/models';
import { downloadPortraitBlob } from './portrait-storage';

export type PortraitTransfer = { card: string; sheet: string };
const prefix='data:image/webp;base64,';
const maxImageBytes=450000;
function blobToDataUrl(blob:Blob):Promise<string> {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Не удалось прочитать портрет для JSON.'));
    reader.onload=()=>resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
export async function portraitToJson(c:Character):Promise<PortraitTransfer|undefined> {
  if(!c.portrait_card_path&&!c.portrait_sheet_path)return undefined;
  if(!c.portrait_card_path||!c.portrait_sheet_path)throw new Error('Не хватает одного из изображений портрета.');
  const [card,sheet]=await Promise.all([downloadPortraitBlob(c.portrait_card_path),downloadPortraitBlob(c.portrait_sheet_path)]);
  const [cardData,sheetData]=await Promise.all([blobToDataUrl(card),blobToDataUrl(sheet)]);
  return {card:cardData,sheet:sheetData};
}
export function parsePortraitTransfer(value:unknown):{card:Blob;sheet:Blob}|undefined {
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Некорректные изображения портрета в JSON.');
  const pair=value as Record<string,unknown>;
  const decode=(item:unknown):Blob=>{
    if(typeof item!=='string'||!item.startsWith(prefix)||item.length>maxImageBytes*1.38)
      throw new Error('JSON содержит некорректный или слишком большой портрет.');
    const base64=item.slice(prefix.length);
    if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('Некорректное кодирование портрета.');
    const bytes=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
    if(bytes.length>maxImageBytes||bytes.length<20)throw new Error('Портрет превышает лимит размера.');
    // RIFF....WEBP header (exclude other types pretending to be WebP).
    const ascii=(start:number,count:number)=>String.fromCharCode(...bytes.subarray(start,start+count));
    if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WEBP')throw new Error('В JSON найдено неподдерживаемое изображение.');
    return new Blob([bytes],{type:'image/webp'});
  };
  return {card:decode(pair.card),sheet:decode(pair.sheet)};
}
