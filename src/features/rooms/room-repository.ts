import {supabase} from '../../lib/supabase';
export function roomOverviewRequests(userId:string){
 const db=supabase!;
 return Promise.all([
 db.from('game_rooms').select('id,owner_id,title,system,invite_code,closed,created_at').order('created_at',{ascending:false}),
 db.from('game_room_members').select('room_id,character_id,user_id,casts_enabled,joined_at,snapshot').eq('user_id',userId),
 db.from('game_room_members').select('room_id,user_id'),
 ]);
}
export function roomDetailRequests(roomId:string){
 const db=supabase!;
 return Promise.all([
 db.from('game_room_members').select('room_id,character_id,user_id,casts_enabled,joined_at,snapshot').eq('room_id',roomId).order('joined_at'),
 db.from('game_room_rolls').select('id,room_id,character_id,formula,label,total,calculation,created_at,dice').eq('room_id',roomId).order('created_at',{ascending:false}).limit(80),
 ]);
}
export function createRoomRow(ownerId:string,title:string,system:'pf2e'|'prmoon'){
 return supabase!.from('game_rooms').insert({owner_id:ownerId,title,system}).select('id').single();
}
export function joinRoomByCode(code:string,characterId:string){
 return supabase!.rpc('join_game_room',{p_code:code.trim().toUpperCase(),p_character:characterId});
}
export function leaveRoomRow(roomId:string,characterId:string){
 return supabase!.from('game_room_members').delete().eq('room_id',roomId).eq('character_id',characterId);
}
export function updateRoomRollPermissions(roomId:string,characterId:string,userId:string,enabled:boolean){
 return supabase!.from('game_room_members').update({casts_enabled:enabled}).eq('room_id',roomId).eq('character_id',characterId).eq('user_id',userId);
}
export function renameRoomRow(roomId:string,title:string){
 return supabase!.from('game_rooms').update({title}).eq('id',roomId);
}
export function setRoomClosed(roomId:string,closed:boolean){
 return supabase!.from('game_rooms').update({closed}).eq('id',roomId);
}
export function deleteRoomRow(roomId:string){
 return supabase!.from('game_rooms').delete().eq('id',roomId);
}
