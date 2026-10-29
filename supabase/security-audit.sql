-- At your service! / checkpoint 0.2.4
-- READ-ONLY audit of live Supabase privileges. No user rows or secrets returned.
-- Does NOT impersonate authenticated users; separate two-account API tests
-- are still required before certifying complete access isolation.

select n.nspname as schema_name,c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
   where p.schemaname=n.nspname and p.tablename=c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname='public'
  and c.relname in ('characters','sheet_admins',
    'sheet_templates','sheet_template_drafts','sheet_template_history')
order by c.relname;

select r.rolname as role_name,
  has_table_privilege(r.rolname,'public.characters','SELECT') as can_select_characters,
  has_table_privilege(r.rolname,'public.sheet_admins','INSERT') as can_assign_admin,
  has_table_privilege(r.rolname,'public.sheet_templates','UPDATE') as can_update_templates,
  has_function_privilege(r.rolname,'public.publish_sheet_template(text)','EXECUTE') as can_call_publish,
  has_function_privilege(r.rolname,'public.reorder_characters(uuid[])','EXECUTE') as can_call_reorder
from pg_roles r where r.rolname in ('anon','authenticated')
order by r.rolname;

select p.proname as function_name,p.prosecdef as security_definer,
  p.proconfig as function_settings
from pg_proc p join pg_namespace n on p.pronamespace=n.oid
where n.nspname='public'
  and p.proname in ('publish_sheet_template','reorder_characters')
order by p.proname;

select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='character-portraits';

select schemaname,tablename,policyname,cmd,roles::text as roles,
  (qual is not null) as has_using,
  (with_check is not null) as has_with_check
from pg_policies
where (schemaname='public'
  and tablename in ('characters','sheet_admins',
   'sheet_templates','sheet_template_drafts','sheet_template_history'))
  or (schemaname='storage' and tablename='objects'
      and policyname like 'Portrait%')
order by schemaname,tablename,policyname;

-- Stage 1 iteration 2: rooms and privileged RPC exposure. Read only.
-- Permission checks must not be confused with a two-JWT end-to-end test.
select n.nspname as schema_name,c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*) from pg_policies p
   where p.schemaname=n.nspname and p.tablename=c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname='public'
  and c.relname in ('game_rooms','game_room_members','game_room_rolls')
order by c.relname;

select r.rolname as role_name,
  has_table_privilege(r.rolname,'public.game_rooms','SELECT') as read_rooms,
  has_table_privilege(r.rolname,'public.game_rooms','INSERT') as create_rooms,
  has_table_privilege(r.rolname,'public.game_room_members','INSERT') as direct_join,
  has_table_privilege(r.rolname,'public.game_room_rolls','INSERT') as direct_post_roll,
  has_function_privilege(r.rolname,'public.join_game_room(text,uuid)','EXECUTE') as call_join,
  has_function_privilege(r.rolname,'public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb)','EXECUTE') as call_roll
from pg_roles r where r.rolname in ('anon','authenticated')
order by r.rolname;

select p.proname as function_name,p.prosecdef as security_definer,p.proconfig as function_settings
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('join_game_room','post_game_room_roll')
order by p.proname;

select schemaname,tablename,policyname,cmd,roles::text as roles,
  (qual is not null) as has_using,(with_check is not null) as has_with_check
from pg_policies
where schemaname='public'
  and tablename in ('game_rooms','game_room_members','game_room_rolls')
order by tablename,policyname;
