import type {Character,CharacterDetails,GameSystem} from '../../lib/models';
import {supabase} from '../../lib/supabase';
import {saveCharacterIfCurrent} from '../../lib/character-save';

// The same projection is used for initial loading, create, CAS and export.
// Keep the authoritative user-id filter on every character read and write.
const CHARACTER_COLUMNS='id, user_id, system, name, details, sort_order, created_at, updated_at, portrait_card_path, portrait_sheet_path, portrait_source_path, portrait_crops';
function database(){
  if(!supabase)throw new Error('Supabase не настроен.');
  return supabase;
}
export function listCharacterRows(userId:string){
  return database().from('characters').select(CHARACTER_COLUMNS)
    .eq('user_id',userId).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
}
export function insertCharacterRow(userId:string,system:GameSystem,name:string,details:CharacterDetails,sortOrder:number){
  return database().from('characters')
    .insert({user_id:userId,system,name,details,sort_order:sortOrder})
    .select(CHARACTER_COLUMNS).single();
}
export function readCharacterRow(userId:string,characterId:string){
  return database().from('characters').select(CHARACTER_COLUMNS)
    .eq('id',characterId).eq('user_id',userId).single();
}
export async function saveCharacterRow(baseline:Character,userId:string,name:string,details:CharacterDetails){
  const client=database();
  const id=baseline.id;
  // Atomic revision CAS is essential; metadata-only revisions are retried by the
  // existing helper after verifying name/details have not changed.
  return saveCharacterIfCurrent(baseline,
    async revision=>client.from('characters').update({name,details})
      .eq('id',id).eq('user_id',userId).eq('updated_at',revision)
      .select(CHARACTER_COLUMNS).maybeSingle(),
    async()=>client.from('characters').select('name,details,updated_at')
      .eq('id',id).eq('user_id',userId).maybeSingle(),
  );
}
export function removeCharacterRow(userId:string,characterId:string){
  return database().from('characters').delete().eq('id',characterId).eq('user_id',userId);
}
export function reorderCharacterRows(ids:string[]){
  return database().rpc('reorder_characters',{p_ids:ids});
}
