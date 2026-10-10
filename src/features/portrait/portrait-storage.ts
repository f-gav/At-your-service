import { supabase } from '../../lib/supabase';
import type { Character } from '../../lib/models';

export const PORTRAIT_BUCKET = 'character-portraits';
export type PortraitPaths = Pick<Character, 'portrait_card_path' | 'portrait_sheet_path'>;
export const portraitPaths = (character: Character): string[] =>
  [character.portrait_card_path,character.portrait_sheet_path].filter((path): path is string => typeof path === 'string' && path.length>0);

function client() {
  if (!supabase) throw new Error('Для портретов требуется вход через Google.');
  return supabase;
}
export async function signedPortraitUrl(path: string): Promise<string> {
  const {data,error} = await client().storage.from(PORTRAIT_BUCKET).createSignedUrl(path,3600);
  if(error||!data) throw new Error(error?.message??'Не удалось загрузить портрет.');
  return data.signedUrl;
}
async function clean(paths: string[]) {
  if(!paths.length)return;
  const {error}=await client().storage.from(PORTRAIT_BUCKET).remove(paths);
  if(error) throw new Error(error.message);
}
/** Upload new, immutable object keys, switch database pointers, then remove stale objects. */
export async function savePortrait(character: Character, userId: string, card: Blob, sheet: Blob): Promise<PortraitPaths> {
  if(card.type!=='image/webp'||sheet.type!=='image/webp'||card.size>400000||sheet.size>400000)
    throw new Error('Портрет должен быть WebP размером не более 400 КБ на изображение.');
  if(character.user_id!==userId) throw new Error('Нельзя изменить чужого персонажа.');
  const nonce = crypto.randomUUID().replace(/-/g,'');
  const base = `${userId}/${character.id}/${nonce}`;
  const next = {portrait_card_path:base+'-card.webp',portrait_sheet_path:base+'-sheet.webp'};
  const old = portraitPaths(character);
  const uploaded: string[]=[];
  try {
    for(const [path,blob] of [[next.portrait_card_path,card],[next.portrait_sheet_path,sheet]] as const) {
      const {error}=await client().storage.from(PORTRAIT_BUCKET).upload(path,blob,{contentType:'image/webp',cacheControl:'3600',upsert:false});
      if(error) throw new Error('Ошибка загрузки портрета: '+error.message);
      uploaded.push(path);
    }
    const {data,error}=await client().from('characters').update(next)
      .eq('id',character.id).eq('user_id',userId)
      .select('id').single();
    if(error||!data)throw new Error('Не удалось связать портрет с персонажем: '+(error?.message??'Неизвестная ошибка'));
  } catch(error) {
    try {await clean(uploaded);} catch { /* new orphan can be cleaned by maintenance */ }
    throw error;
  }
  // The newly saved portrait is valid even if removing an older file fails.
  try { await clean(old); } catch(e) { console.warn('Could not remove old portrait',e); }
  return next;
}
export async function removePortrait(character: Character,userId:string):Promise<PortraitPaths> {
  if(character.user_id!==userId)throw new Error('Нельзя изменить чужого персонажа.');
  const old=portraitPaths(character);
  const {data,error}=await client().from('characters').update({portrait_card_path:null,portrait_sheet_path:null})
    .eq('id',character.id).eq('user_id',userId).select('id').single();
  if(error||!data)throw new Error(error?.message??'Не удалось удалить портрет.');
  try {await clean(old);}catch(e){console.warn('Could not remove unlinked portrait',e);}
  return {portrait_card_path:null,portrait_sheet_path:null};
}
export async function cleanupBeforeDelete(character:Character):Promise<void> {
  await clean(portraitPaths(character));
}
export async function downloadPortraitBlob(path:string):Promise<Blob> {
  const {data,error}=await client().storage.from(PORTRAIT_BUCKET).download(path);
  if(error||!data)throw new Error('Не удалось включить портрет в JSON: '+(error?.message??'файл недоступен'));
  if(data.type!=='image/webp'||data.size>450000)throw new Error('Неподдерживаемый файл портрета.');
  return data;
}
