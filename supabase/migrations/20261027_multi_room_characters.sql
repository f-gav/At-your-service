-- A single character may belong to several rooms of the same system.
-- Preserve all existing rows. The composite primary key (room_id,character_id)
-- still rejects duplicate membership within one room.
alter table public.game_room_members
  drop constraint if exists game_room_members_character_id_key;
create index if not exists game_room_members_character_idx
  on public.game_room_members(character_id);

-- Reuse the original guarded join RPC, with uniqueness scoped to destination.
create or replace function public.join_game_room(p_code text,p_character uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare
  caller uuid:=(select auth.uid());
  chosen public.characters%rowtype;
  destination public.game_rooms%rowtype;
begin
  if caller is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if p_code is null or upper(trim(p_code)) !~ '^[A-F0-9]{8}$'
    then raise exception 'Invalid room code' using errcode='22023'; end if;
  select * into chosen from public.characters c
  where c.id=p_character and c.user_id=caller;
  if not found then raise exception 'Character unavailable' using errcode='42501'; end if;
  if chosen.system not in ('pf2e','prmoon') then
    raise exception 'Unsupported character system' using errcode='22023'; end if;
  select * into destination from public.game_rooms r
  where r.invite_code=upper(trim(p_code)) and r.closed=false for update;
  if not found then raise exception 'Room not found or closed' using errcode='22023'; end if;
  if destination.system<>chosen.system then
    raise exception 'Character system does not match room' using errcode='22023'; end if;
  if exists(select 1 from public.game_room_members m where m.room_id=destination.id and m.character_id=p_character)
    then raise exception 'Character is already in this room' using errcode='23505'; end if;
  if (select count(*) from public.game_room_members m where m.room_id=destination.id)>=24
    then raise exception 'Room is full' using errcode='22023'; end if;
  insert into public.game_room_members(room_id,character_id,user_id,snapshot)
    values(destination.id,p_character,caller,
      ays_rooms_private.room_snapshot(chosen.system,chosen.name,chosen.details));
  return destination.id;
end;
$$;
