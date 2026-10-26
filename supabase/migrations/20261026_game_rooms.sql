-- At your service! | System-scoped rooms, October 2026.
-- Apply to the SAME Supabase project as public.characters (not WreckLib).
-- A room sees only compact resource snapshots, never another user's sheet JSON.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 100),
  system text not null check (system in ('pf2e','prmoon')),
  invite_code text not null unique default upper(left(replace(gen_random_uuid()::text,'-',''),8))
    check (invite_code ~ '^[A-F0-9]{8}$'),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists game_rooms_owner_idx on public.game_rooms(owner_id);

create table if not exists public.game_room_members (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  character_id uuid not null unique references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot)='object' and pg_column_size(snapshot)<4096),
  casts_enabled boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key(room_id,character_id)
);
create index if not exists game_room_members_user_idx on public.game_room_members(user_id);
create index if not exists game_room_members_room_idx on public.game_room_members(room_id);

create table if not exists public.game_room_rolls (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  formula text not null check(char_length(formula) between 1 and 1000),
  label text not null default '' check(char_length(label)<=120),
  total bigint not null,
  calculation text not null default '' check(char_length(calculation)<=2500),
  dice jsonb not null default '[]'::jsonb check(jsonb_typeof(dice)='array' and pg_column_size(dice)<16000),
  created_at timestamptz not null default now()
);
create index if not exists game_room_rolls_time_idx on public.game_room_rolls(room_id,created_at desc);

-- Deliberately scoped privileged helpers: no user metadata, no arbitrary SQL,
-- no user-provided role IDs; hardcoded tables and empty search_path.
create or replace function private.room_can_view(p_room uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.game_rooms r
    where r.id=p_room and (
      r.owner_id=(select auth.uid()) or exists(
        select 1 from public.game_room_members m
        where m.room_id=r.id and m.user_id=(select auth.uid())
      )
    )
  );
$$;
revoke all on function private.room_can_view(uuid) from public,anon;
grant execute on function private.room_can_view(uuid) to authenticated;

create or replace function private.room_int(raw text)
returns integer language sql immutable set search_path='' as $$
  select case when raw ~ '^[-+]?[0-9]{1,7}$' then raw::integer else null end
$$;
revoke all on function private.room_int(text) from public,anon;

create or replace function private.room_snapshot(p_system text,p_name text,p_details jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare
  sheet jsonb;
  f jsonb;
  rank_no integer;
  ability integer;
  hp_max text;
  st_max text;
  sp_max text;
begin
  if p_system='pf2e' then
    sheet:=coalesce(p_details->'pathfinderSheet','{}'::jsonb);
    return jsonb_build_object(
      'name',p_name,
      'hpCurrent',coalesce(sheet->>'hp_current',''),
      'hpMax',coalesce(sheet->>'hp_max',''),
      'hpTemp',coalesce(sheet->>'hp_temp',''),
      'ac',coalesce(sheet->>'armor_class',''),
      'level',coalesce(sheet->>'level','')
    );
  elsif p_system='prmoon' then
    sheet:=coalesce(p_details->'projectMoonSheet','{}'::jsonb);
    f:=coalesce(sheet->'fields','{}'::jsonb);
    rank_no:=private.room_int(f->>'rank');
    hp_max:=coalesce(sheet#>>'{maxOverrides,hp}',f->>'hpMax','');
    st_max:=coalesce(sheet#>>'{maxOverrides,st}',f->>'stMax','');
    sp_max:=coalesce(sheet#>>'{maxOverrides,sp}',f->>'spMax','');
    if sheet->>'autoVitals'='true' then
      ability:=private.room_int(f->>'fortitude');
      if ability is not null and rank_no is not null and sheet#>>'{maxOverrides,hp}' is null
        then hp_max:=(64+8*ability+32*rank_no)::text; end if;
      ability:=private.room_int(f->>'charm');
      if ability is not null and rank_no is not null and sheet#>>'{maxOverrides,st}' is null
        then st_max:=(20+4*ability+4*rank_no)::text; end if;
      ability:=private.room_int(f->>'prudence');
      if ability is not null and sheet#>>'{maxOverrides,sp}' is null
        then sp_max:=(15+3*ability)::text; end if;
    end if;
    return jsonb_build_object(
      'name',p_name,'hpCurrent',coalesce(f->>'hpCurrent',''),'hpMax',hp_max,
      'stCurrent',coalesce(f->>'stCurrent',''),'stMax',st_max,
      'spCurrent',coalesce(f->>'spCurrent',''),'spMax',sp_max,
      'rank',coalesce(f->>'rank','')
    );
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function private.room_snapshot(text,text,jsonb) from public,anon;

-- This trigger follows the existing autosave. It publishes only the small
-- explicitly whitelisted snapshot, never a full character's details.
create or replace function private.room_refresh_member()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.game_room_members m
  set snapshot=private.room_snapshot(new.system,new.name,new.details)
  where m.character_id=new.id and m.user_id=new.user_id;
  return new;
end;
$$;
drop trigger if exists room_refresh_on_character on public.characters;
create trigger room_refresh_on_character
after update of details,name on public.characters
for each row execute function private.room_refresh_member();

-- Character system/owner must be immutable while linked. Explicit check
-- prevents cross-system reclassification by direct client UPDATE.
create or replace function private.room_check_member()
returns trigger language plpgsql set search_path='' as $$
declare
  target_system text;
  char_system text;
  char_owner uuid;
  char_name text;
  char_details jsonb;
begin
  select r.system into target_system from public.game_rooms r where r.id=new.room_id;
  select c.system,c.user_id,c.name,c.details
  into char_system,char_owner,char_name,char_details
  from public.characters c where c.id=new.character_id;
  if char_owner is distinct from new.user_id or char_system is distinct from target_system
    then raise exception 'System or owner mismatch in room membership' using errcode='23514'; end if;
  new.snapshot:=private.room_snapshot(char_system,char_name,char_details);
  return new;
end;
$$;
drop trigger if exists game_room_member_check on public.game_room_members;
create trigger game_room_member_check
before insert on public.game_room_members
for each row execute function private.room_check_member();

-- Joining by invite code is the one deliberately privileged operation:
-- the player may see ONLY their own character; room information is not
-- revealed until the character and room system match.
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
  if exists(select 1 from public.game_room_members m where m.character_id=p_character)
    then raise exception 'Character is already in a room' using errcode='23505'; end if;
  if (select count(*) from public.game_room_members m where m.room_id=destination.id)>=24
    then raise exception 'Room is full' using errcode='22023'; end if;
  insert into public.game_room_members(room_id,character_id,user_id,snapshot)
    values(destination.id,p_character,caller,
      private.room_snapshot(chosen.system,chosen.name,chosen.details));
  return destination.id;
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
  if caller is null then raise exception 'Sign in required' using errcode='28000'; end if;
  if not exists(
    select 1 from public.game_room_members m
    join public.game_rooms r on r.id=m.room_id
    where m.room_id=p_room and m.character_id=p_character and m.user_id=caller
      and m.casts_enabled=true and r.closed=false
  ) then raise exception 'Not allowed to send rolls' using errcode='42501'; end if;
  if p_formula is null or char_length(p_formula) not between 1 and 1000
    or coalesce(char_length(p_label),0)>120
    or coalesce(char_length(p_calculation),0)>2500
    or p_dice is null or jsonb_typeof(p_dice)<>'array' or pg_column_size(p_dice)>16000
    then raise exception 'Invalid roll payload' using errcode='22023'; end if;
  insert into public.game_room_rolls(room_id,character_id,user_id,formula,label,total,calculation,dice)
  values(p_room,p_character,caller,p_formula,coalesce(p_label,''),
    p_total,coalesce(p_calculation,''),p_dice)
  returning id into out_id;
  return out_id;
end;
$$;
revoke all on function public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb) from public,anon;
grant execute on function public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb) to authenticated;

alter table public.game_rooms enable row level security;
alter table public.game_room_members enable row level security;
alter table public.game_room_rolls enable row level security;

revoke all on public.game_rooms,public.game_room_members,public.game_room_rolls from anon,authenticated;
grant select,insert,delete on public.game_rooms to authenticated;
grant update(title,closed) on public.game_rooms to authenticated;
grant select,delete on public.game_room_members to authenticated;
grant update(casts_enabled) on public.game_room_members to authenticated;
grant select on public.game_room_rolls to authenticated;
-- Neither inserting members nor posting rolls is possible via direct table REST.

create policy "rooms_participants_read" on public.game_rooms
for select to authenticated using (private.room_can_view(id));
create policy "rooms_owner_create" on public.game_rooms
for insert to authenticated with check ((select auth.uid())=owner_id);
create policy "rooms_owner_edit" on public.game_rooms
for update to authenticated using ((select auth.uid())=owner_id)
with check ((select auth.uid())=owner_id);
create policy "rooms_owner_delete" on public.game_rooms
for delete to authenticated using ((select auth.uid())=owner_id);

create policy "members_participants_read" on public.game_room_members
for select to authenticated using (private.room_can_view(room_id));
create policy "members_toggle_self" on public.game_room_members
for update to authenticated using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);
create policy "members_self_or_owner_leave" on public.game_room_members
for delete to authenticated using (
  (select auth.uid())=user_id
  or exists(select 1 from public.game_rooms r where r.id=room_id and r.owner_id=(select auth.uid()))
);
create policy "rolls_participants_read" on public.game_room_rolls
for select to authenticated using (private.room_can_view(room_id));

-- Authenticated Realtime clients receive only authorized room/member/roll rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='game_room_members'
  ) then alter publication supabase_realtime add table public.game_room_members; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='game_room_rolls'
  ) then alter publication supabase_realtime add table public.game_room_rolls; end if;
end;
$$;

-- Migration verification query (read-only): inspect RLS and RPC grants after
-- installing the migration in the correct At your service! Supabase project.
