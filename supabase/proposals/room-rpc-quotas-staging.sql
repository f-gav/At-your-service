-- STAGING PROPOSAL ONLY. DO NOT APPLY TO PRODUCTION UNTIL AN INDEPENDENT
-- DB+STORAGE RESTORE AND TWO-JWT RPC E2E HAVE SUCCEEDED.
-- Not inside supabase/migrations on purpose: merging this file does NOT
-- deploy a database change.
--
-- Proposal: preserve the existing UUID/null PostgREST RPC contract and
-- count expected failed attempts without rolling the quota counter back.
-- Fixed 10-second buckets allow boundary bursts; use a longer window/edge
-- enforcement if stronger anti-abuse guarantees are required.
--
-- IMPORTANT: Verify fully on an ISOLATED RESTORED project first. An operator
-- must apply this deliberately, then verify grants, quota concurrency,
-- ownership checks, closed rooms, and UI error handling.
BEGIN;

create schema if not exists ays_rooms_private;
revoke all on schema ays_rooms_private from public,anon;

create table if not exists ays_rooms_private.room_rpc_quotas (
  user_id uuid not null,
  operation text not null check(operation in ('join','roll')),
  window_slot bigint not null,
  attempts integer not null check(attempts > 0),
  primary key(user_id,operation,window_slot)
);
revoke all on ays_rooms_private.room_rpc_quotas from public,anon,authenticated;

-- Atomic under concurrent callers: unique key + ON CONFLICT row lock.
-- The caller identity comes exclusively from auth.uid(), never a function arg.
create or replace function ays_rooms_private.take_room_rpc_quota(p_operation text)
returns boolean
language plpgsql volatile security definer set search_path=''
as $$
declare
  caller uuid:=(select auth.uid());
  slot bigint:=(floor(extract(epoch from clock_timestamp())/10))::bigint;
  quota integer;
  accepted boolean:=false;
begin
  if caller is null then return false; end if;
  if p_operation='join' then quota:=2;
  elsif p_operation='roll' then quota:=10;
  else return false;
  end if;

  insert into ays_rooms_private.room_rpc_quotas(user_id,operation,window_slot,attempts)
  values(caller,p_operation,slot,1)
  on conflict(user_id,operation,window_slot) do update
    set attempts=ays_rooms_private.room_rpc_quotas.attempts+1
    where ays_rooms_private.room_rpc_quotas.attempts < quota
  returning true into accepted;
  return coalesce(accepted,false);
end;
$$;
revoke all on function ays_rooms_private.take_room_rpc_quota(text)
  from public,anon,authenticated;

-- A rejected login uses NULL rather than raising an exception. Otherwise
-- Postgres would roll back the quota write together with a raised error,
-- leaving invalid-code guessing effectively unlimited.
-- Same-system validation and current multi-room semantics are preserved
-- here until the separately planned Rooms V2 "one character, one room" change.
create or replace function public.join_game_room(p_code text,p_character uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  caller uuid:=(select auth.uid());
  chosen public.characters%rowtype;
  destination public.game_rooms%rowtype;
begin
  if caller is null then return null; end if;
  if not ays_rooms_private.take_room_rpc_quota('join') then return null; end if;
  begin
    if p_code is null or upper(trim(p_code)) !~ '^[A-F0-9]{8}$'
      then return null; end if;
    select * into chosen from public.characters c
      where c.id=p_character and c.user_id=caller;
    if not found or chosen.system not in ('pf2e','prmoon')
      then return null; end if;
    select * into destination from public.game_rooms r
      where r.invite_code=upper(trim(p_code)) and r.closed=false for update;
    if not found or destination.system<>chosen.system then return null; end if;
    if exists(select 1 from public.game_room_members m
              where m.room_id=destination.id and m.character_id=p_character)
      then return null; end if;
    if (select count(*) from public.game_room_members m where m.room_id=destination.id)>=24
      then return null; end if;
    insert into public.game_room_members(room_id,character_id,user_id,snapshot)
      values(destination.id,p_character,caller,
        ays_rooms_private.room_snapshot(chosen.system,chosen.name,chosen.details));
    return destination.id;
  exception
    when unique_violation or check_violation or foreign_key_violation
      then return null;
  end;
end;
$$;
revoke all on function public.join_game_room(text,uuid) from public,anon;
grant execute on function public.join_game_room(text,uuid) to authenticated;

create or replace function public.post_game_room_roll(
  p_room uuid,p_character uuid,p_formula text,p_label text,
  p_total bigint,p_calculation text,p_dice jsonb
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
  caller uuid:=(select auth.uid());
  out_id uuid;
begin
  if caller is null then return null; end if;
  if not ays_rooms_private.take_room_rpc_quota('roll') then return null; end if;
  begin
    if not exists(
      select 1 from public.game_room_members m
      join public.game_rooms r on r.id=m.room_id
      where m.room_id=p_room and m.character_id=p_character
        and m.user_id=caller and m.casts_enabled=true
    ) then return null; end if;
    if p_formula is null or char_length(p_formula) not between 1 and 1000
      or coalesce(char_length(p_label),0)>120
      or coalesce(char_length(p_calculation),0)>2500
      or p_dice is null or jsonb_typeof(p_dice)<>'array'
      or pg_column_size(p_dice)>16000
    then return null; end if;
    insert into public.game_room_rolls(room_id,character_id,user_id,formula,label,total,calculation,dice)
      values(p_room,p_character,caller,p_formula,coalesce(p_label,''),
        p_total,coalesce(p_calculation,''),p_dice)
      returning id into out_id;
    return out_id;
  exception
    when unique_violation or check_violation or foreign_key_violation
      then return null;
  end;
end;
$$;
revoke all on function public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb)
  from public,anon;
grant execute on function public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb)
  to authenticated;

-- Operational cleanup is NOT automatic. Schedule from a privileged trusted
-- operator if the proposal is later deployed. This table otherwise grows.
create or replace function ays_rooms_private.prune_room_rpc_quotas()
returns bigint language plpgsql security definer set search_path=''
as $$
declare
  rows_deleted bigint;
begin
  delete from ays_rooms_private.room_rpc_quotas
    where window_slot < floor(extract(epoch from clock_timestamp())/10)::bigint - 8640;
  get diagnostics rows_deleted=row_count;
  return rows_deleted;
end;
$$;
revoke all on function ays_rooms_private.prune_room_rpc_quotas()
  from public,anon,authenticated;

COMMIT;
