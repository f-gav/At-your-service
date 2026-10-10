import type { Character } from '../../lib/models';
import { downloadPortraitBlob } from './portrait-storage';
import { validCrops } from './crop';
import type { PortraitCrops } from './crop';

// v1 JSON supports both the former paired pictures and the new one-source form.
export type PortraitTransfer={source:string;crops:PortraitCrops}|{card:string;sheet:string};
export type ParsedPortrait={type:'source';source:Blob;crops:PortraitCrops}|{type:'legacy';card:Blob;sheet:Blob};
const prefix='data:image/webp;base64,';
const maxImageBytes=450000;
function blobToDataUrl(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('Не удалось прочитать портрет для JSON.'));
    reader.onload=()=>resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
function decode(item:unknown):Blob{
  if(typeof item!=='string'||!item.startsWith(prefix)||item.length>maxImageBytes*1.38)
    throw new Error('JSON содержит некорректный или слишком большой портрет.');
  const base64=item.slice(prefix.length);
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw new Error('Некорректное кодирование портрета.');
  const bytes=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
  if(bytes.length>maxImageBytes||bytes.length<20)throw new Error('Портрет превышает лимит размера.');
  const ascii=(start:number,count:number)=>String.fromCharCode(...bytes.subarray(start,start+count));
  if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WEBP')throw new Error('JSON содержит неподдерживаемое изображение.');
  return new Blob([bytes],{type:'image/webp'});
}
export async function portraitToJson(c:Character):Promise<PortraitTransfer|undefined>{
  if(c.portrait_source_path){
    if(!validCrops(c.portrait_crops))throw new Error('Некорректное кадрирование портрета.');
    return {source:await blobToDataUrl(await downloadPortraitBlob(c.portrait_source_path)),crops:c.portrait_crops};
  }
  if(!c.portrait_card_path&&!c.portrait_sheet_path)return undefined;
  if(!c.portrait_card_path||!c.portrait_sheet_path)throw new Error('Не хватает одной из частей старого портрета.');
  const [card,sheet]=await Promise.all([
    downloadPortraitBlob(c.portrait_card_path),downloadPortraitBlob(c.portrait_sheet_path)
  ]);
  return {card:await blobToDataUrl(card),sheet:await blobToDataUrl(sheet)};
}
export function parsePortraitTransfer(value:unknown):ParsedPortrait|undefined{
  if(value===undefined)return undefined;
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('Некорректный портрет в JSON.');
  const pair=value as Record<string,unknown>;
  if('source' in pair){
    if(!validCrops(pair.crops)||'card' in pair||'sheet' in pair)
      throw new Error('Некорректные кадры в JSON.');
    return {type:'source',source:decode(pair.source),crops:pair.crops};
  }
  if(!('card' in pair)||!('sheet' in pair))
    throw new Error('Некорректный старый формат портрета.');
  return {type:'legacy',card:decode(pair.card),sheet:decode(pair.sheet)};
}
