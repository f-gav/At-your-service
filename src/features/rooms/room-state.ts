/** Rooms V2 view-state and capability model. Server RLS/RPC remain authoritative. */
export type RoomSystem='pf2e'|'prmoon';
export type RoomRole='anonymous'|'owner'|'participant'|'outsider';
export type RoomScreen='sign-in'|'overview'|'selected'|'unavailable';
export type RoomViewState={screen:RoomScreen;role:RoomRole;canManage:boolean;canEditOwnRolls:boolean;canJoin:boolean};
export type RoomSummary={id:string;owner_id:string;system:RoomSystem;closed:boolean};
export type RoomParticipant={room_id:string;user_id:string;character_id:string};
export function roomRole(userId:string|null,room:RoomSummary|null,memberRows:readonly RoomParticipant[]):RoomRole{
 if(!userId)return 'anonymous';
 if(!room)return 'outsider';
 if(room.owner_id===userId)return 'owner';
 return memberRows.some(m=>m.room_id===room.id&&m.user_id===userId)?'participant':'outsider';
}
export function roomViewState(userId:string|null,selectedId:string|null,room:RoomSummary|null,members:readonly RoomParticipant[]):RoomViewState{
 const role=roomRole(userId,room,members);
 return {
  screen:!userId?'sign-in':!selectedId?'overview':!room?'unavailable':'selected',
  role,
  canManage:role==='owner',
  canEditOwnRolls:role==='owner'||role==='participant',
  canJoin:!!userId&&!!room&&!room.closed,
 };
}
export function canAttachCharacter(roomSystem:RoomSystem,characterSystem:string,alreadyInDestination:boolean):boolean{
 return characterSystem===roomSystem&&!alreadyInDestination;
}
export function distinctRoomUsers(rows:readonly Pick<RoomParticipant,'room_id'|'user_id'>[]):Record<string,number>{
 const counts:Record<string,Set<string>>={};
 for(const member of rows)(counts[member.room_id]??=new Set()).add(member.user_id);
 return Object.fromEntries(Object.entries(counts).map(([id,users])=>[id,users.size]));
}
