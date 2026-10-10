-- At your service v0.1: run once in the SQL editor of a NEW Supabase project.
-- Each authenticated user can only access their own character rows.
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  system text not null check (system in ('dnd5e', 'pf2e', 'vtm5e')),
  name text not null check (char_length(trim(name)) between 1 and 100),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sort_order bigint not null default 0
);

alter table public.characters add column if not exists sort_order bigint not null default 0;

create index if not exists characters_user_sort_idx
  on public.characters (user_id, sort_order, created_at, id);

create index if not exists characters_user_updated_idx
  on public.characters (user_id, updated_at desc);

create or replace function public.characters_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_touch_updated_at on public.characters;
create trigger characters_touch_updated_at
before update on public.characters
for each row execute function public.characters_touch_updated_at();

alter table public.characters enable row level security;

-- No table privileges for visitors who are not logged in.
revoke all on table public.characters from anon, authenticated;
grant select, insert, update, delete on table public.characters to authenticated;

-- Safe to re-run this setup script without duplicating policies.
drop policy if exists "characters_select_own" on public.characters;
drop policy if exists "characters_insert_own" on public.characters;
drop policy if exists "characters_update_own" on public.characters;
drop policy if exists "characters_delete_own" on public.characters;

create policy "characters_select_own" on public.characters
for select to authenticated using ((select auth.uid()) = user_id);

create policy "characters_insert_own" on public.characters
for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "characters_update_own" on public.characters
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "characters_delete_own" on public.characters
for delete to authenticated using ((select auth.uid()) = user_id);

-- SECURITY INVOKER ensures existing owner-only RLS applies to every updated row.
-- A single RPC call atomically persists the entire sequence.
create or replace function public.reorder_characters(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  owned_count bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_ids is null then
    raise exception 'Character order must not be null' using errcode = '22023';
  end if;

  select count(*) into owned_count
  from public.characters
  where user_id = current_user_id;

  if cardinality(p_ids) <> owned_count
    or (select count(distinct item.id) from unnest(p_ids) as item(id)) <> owned_count
    or (select count(*) from public.characters as c
        join unnest(p_ids) as item(id) on item.id = c.id
        where c.user_id = current_user_id) <> owned_count
  then
    raise exception 'Character order must contain each of your characters exactly once'
      using errcode = '22023';
  end if;

  update public.characters as c
  set sort_order = item.position
  from unnest(p_ids) with ordinality as item(id, position)
  where c.id = item.id and c.user_id = current_user_id;
end;
$$;

revoke all on function public.reorder_characters(uuid[]) from public, anon;
grant execute on function public.reorder_characters(uuid[]) to authenticated;

-- No public or anonymous policy. The client is never supplied a service_role key.

-- Existing installations should apply supabase/migrations/20261010_character_order.sql
-- before deploying the updated frontend, preserving the old card order.
