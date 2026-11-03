/** Mutations protected by RLS can succeed with zero affected rows; treat that as a conflict. */
export function requireRoomMutationRows(rows:readonly unknown[]|null|undefined,error:unknown,message:string):void {
  if(error)throw error;
  if(!rows?.length)throw new Error(message);
}
