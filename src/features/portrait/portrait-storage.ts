import { supabase } from '../../lib/supabase';
import type { Character } from '../../lib/models';
import type { PortraitCrops } from './crop';
import { validCrops } from './crop';

export const PORTRAIT_BUCKET='character-portraits';
export type PortraitPaths=Pick<Character,'portrait_card_path'|'portrait_sheet_path'|'portrait_source_path'|'portrait_crops'>;
export const portraitPaths=(c:Character):string[] =>
  [c.portrait_source_path,c.portrait_card_path,c.portrait_sheet_path]
    .filter((p):p is string=>typeof p==='string'&&p.length>0);
function client(){
  if(!supabase)throw new Error('Для портретов требуется вход через Google.');
  return supabase;
}
export async function signedPortraitUrl(path:string):Promise<string>{
  const {data,error}=await client().storage.from(PORTRAIT_BUCKET).createSignedUrl(path,3600);
  if(error||!data)throw new Error(error?.message??'Не удалось загрузить портрет.');
  return data.signedUrl;
}
async function clean(paths:string[]){
  if(!paths.length)return;
  const {error}=await client().storage.from(PORTRAIT_BUCKET).remove(paths);
  if(error)throw new Error(error.message);
}
function verifyOwner(c:Character,userId:string){
  if(c.user_id!==userId)throw new Error('Нельзя изменить чужого персонажа.');
}
async function upload(path:string,blob:Blob){
  if(blob.type!=='image/webp'||blob.size>400000)
    throw new Error('Портрет должен быть WebP до 400 КБ.');
  const {error}=await client().storage.from(PORTRAIT_BUCKET).upload(path,blob,
    {contentType:'image/webp',cacheControl:'3600',upsert:false});
  if(error)throw new Error('Ошибка загрузки портрета: '+error.message);
}
/** New representation: one original WebP and two independent crop rectangles. */
export async function savePortrait(c:Character,userId:string,source:Blob,crops:PortraitCrops):Promise<PortraitPaths>{
  verifyOwner(c,userId);
  if(!validCrops(crops))throw new Error('Некорректное кадрирование портрета.');
  const base=`${userId}/${c.id}/${crypto.randomUUID().replace(/-/g,'')}`;
  const path=base+'-source.webp',old=portraitPaths(c);
  await upload(path,source);
  const next:PortraitPaths={
    portrait_source_path:path,portrait_crops:crops,portrait_card_path:null,portrait_sheet_path:null,
  };
  try{
    const {data,error}=await client().from('characters').update(next)
      .eq('id',c.id).eq('user_id',userId).select('id').single();
    if(error||!data)throw new Error(error?.message??'Не удалось связать портрет с персонажем.');
  }catch(e){try{await clean([path]);}catch{}throw e;}
  try{await clean(old);}catch(e){console.warn('Could not remove older portrait',e);}
  return next;
}
/** Imports legacy JSON with two pre-cropped WebP files without discarding user's images. */
export async function saveLegacyPortrait(c:Character,userId:string,card:Blob,sheet:Blob):Promise<PortraitPaths>{
  verifyOwner(c,userId);
  const base=`${userId}/${c.id}/${crypto.randomUUID().replace(/-/g,'')}`;
  const next:PortraitPaths={
    portrait_card_path:base+'-card.webp',portrait_sheet_path:base+'-sheet.webp',
    portrait_source_path:null,portrait_crops:null,
  };
  const uploaded:string[]=[];
  try{
    await upload(next.portrait_card_path!,card);uploaded.push(next.portrait_card_path!);
    await upload(next.portrait_sheet_path!,sheet);uploaded.push(next.portrait_sheet_path!);
    const {data,error}=await client().from('characters').update(next)
      .eq('id',c.id).eq('user_id',userId).select('id').single();
    if(error||!data)throw new Error(error?.message??'Не удалось сохранить старый формат портрета.');
  }catch(e){try{await clean(uploaded);}catch{}throw e;}
  try{await clean(portraitPaths(c));}catch(e){console.warn('Could not remove older portrait',e);}
  return next;
}
export async function removePortrait(c:Character,userId:string):Promise<PortraitPaths>{
  verifyOwner(c,userId);
  const next:PortraitPaths={
    portrait_card_path:null,portrait_sheet_path:null,portrait_source_path:null,portrait_crops:null,
  };
  const {data,error}=await client().from('characters').update(next)
    .eq('id',c.id).eq('user_id',userId).select('id').single();
  if(error||!data)throw new Error(error?.message??'Не удалось удалить портрет.');
  try{await clean(portraitPaths(c));}catch(e){console.warn('Could not remove unlinked portrait',e);}
  return next;
}
export async function cleanupBeforeDelete(c:Character):Promise<void>{
  await clean(portraitPaths(c));
}
export async function downloadPortraitBlob(path:string):Promise<Blob>{
  const {data,error}=await client().storage.from(PORTRAIT_BUCKET).download(path);
  if(error||!data)throw new Error('Не удалось включить портрет в JSON: '+(error?.message??'файл недоступен'));
  if(data.type!=='image/webp'||data.size>450000)throw new Error('Неподдерживаемый файл портрета.');
  return data;
}
