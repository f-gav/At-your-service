-- Visual v1: persistent character order. Existing rows keep their previous display order.
alter table public.characters add column if not exists sort_order bigint;

with ranked as (
  select id, row_number() over (
    partition by user_id order by updated_at desc, created_at desc, id
  ) as position
  from public.characters
)
update public.characters as c
set sort_order = ranked.position
from ranked
where c.id = ranked.id and c.sort_order is null;

alter table public.characters alter column sort_order set default 0;
alter table public.characters alter column sort_order set not null;

create index if not exists characters_user_sort_idx
  on public.characters (user_id, sort_order, created_at, id);

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
