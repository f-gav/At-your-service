-- Read-only SHA-256 inventory for an independently restored DB.
-- No private row content, names or IDs are returned; preserve manifests
-- privately because hashes can still contain sensitive correlations.
-- For now the dataset is small; string_agg can require substantial memory
-- for large instances. Reimplement as streamed chunks before scaling up.
-- Source and isolated restore MUST run at the same consistent snapshot.
BEGIN READ ONLY;
SET LOCAL TIME ZONE 'UTC';

select 'characters'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.id),''),
    'UTF8')),'hex') as row_sha256
from public.characters t
union all
select 'sheet_admins'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.user_id),''),
    'UTF8')),'hex') as row_sha256
from public.sheet_admins t
union all
select 'sheet_templates'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.template_key),''),
    'UTF8')),'hex') as row_sha256
from public.sheet_templates t
union all
select 'sheet_template_drafts'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.template_key),''),
    'UTF8')),'hex') as row_sha256
from public.sheet_template_drafts t
union all
select 'sheet_template_history'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.template_key, t.version),''),
    'UTF8')),'hex') as row_sha256
from public.sheet_template_history t
union all
select 'game_rooms'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.id),''),
    'UTF8')),'hex') as row_sha256
from public.game_rooms t
union all
select 'game_room_members'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.room_id, t.character_id),''),
    'UTF8')),'hex') as row_sha256
from public.game_room_members t
union all
select 'game_room_rolls'::text as table_name,
  count(*)::bigint as row_count,
  encode(sha256(convert_to(
    coalesce(string_agg(to_jsonb(t)::text, E'\\n' order by t.id),''),
    'UTF8')),'hex') as row_sha256
from public.game_room_rolls t
order by table_name;

ROLLBACK;
