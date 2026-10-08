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
  updated_at timestamptz not null default now()
);

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

-- No public or anonymous policy. The client is never supplied a service_role key.
