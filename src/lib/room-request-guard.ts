/**
 * Best-effort client-side rate limiting, to avoid accidental request bursts.
 *
 * SECURITY: this is NOT an abuse defense. A caller can bypass browser code,
 * reload the page, or invoke PostgREST directly. Server-enforced rate limits
 * for join_game_room/post_game_room_roll require a separately reviewed DB
 * migration after verified DB + Storage restore.
 */
export type RoomRequestKind='join'|'roll';
type Rule={windowMs:number;max:number};
const rules:Record<RoomRequestKind,Rule>={
  join:{windowMs:10000,max:2},
  roll:{windowMs:10000,max:10},
};

export function createRoomRequestGuard(){
  const attempts=new Map<string,number[]>();
  return function take(kind:RoomRequestKind,scope='',now=Date.now()):boolean {
    const rule=rules[kind];
    const key=kind+':'+scope;
    const previous=(attempts.get(key)??[]).filter(t=>now>=t&&now-t<rule.windowMs);
    if(previous.length>=rule.max){attempts.set(key,previous);return false;}
    attempts.set(key,[...previous,now]);
    return true;
  };
}

export const takeRoomRequestPermit=createRoomRequestGuard();
