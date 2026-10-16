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
