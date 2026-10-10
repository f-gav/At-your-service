-- Template editor v1. Run once in At your service! Supabase project.
-- Server-side roles: don't use user_metadata or frontend display names for privileges.
create table if not exists public.sheet_admins(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.sheet_admins enable row level security;
revoke all on public.sheet_admins from anon,authenticated;
grant select on public.sheet_admins to authenticated;
create policy sheet_admins_own on public.sheet_admins for select to authenticated using(user_id=(select auth.uid()));
-- Bootstrap only when exactly one Google user exists at initial installation.
insert into public.sheet_admins(user_id)
select id from auth.users where raw_app_meta_data->>'provider'='google'
and (select count(*) from auth.users)=1 on conflict do nothing;
create table if not exists public.sheet_templates(
  template_key text primary key, fields jsonb not null
  check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 1 and 650),
  version integer not null default 1 check(version>0),updated_at timestamptz not null default now()
);
create table if not exists public.sheet_template_drafts(
  template_key text primary key,fields jsonb not null
  check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 1 and 650),
  updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table if not exists public.sheet_template_history(
  template_key text not null,version integer not null,fields jsonb not null
  check(jsonb_typeof(fields)='array'),published_by uuid references auth.users(id),
  published_at timestamptz not null default now(),primary key(template_key,version)
);
alter table public.sheet_templates enable row level security;
alter table public.sheet_template_drafts enable row level security;
alter table public.sheet_template_history enable row level security;
revoke all on public.sheet_templates,public.sheet_template_drafts,public.sheet_template_history from anon,authenticated;
grant select,insert,update on public.sheet_templates,public.sheet_template_drafts to authenticated;
grant select,insert on public.sheet_template_history to authenticated;
create policy sheet_templates_read on public.sheet_templates for select to authenticated using(true);
create policy sheet_templates_admin_insert on public.sheet_templates for insert to authenticated
with check(exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));
create policy sheet_templates_admin_update on public.sheet_templates for update to authenticated
using(exists(select 1 from public.sheet_admins where user_id=(select auth.uid())))
with check(exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));
create policy sheet_drafts_admin_select on public.sheet_template_drafts for select to authenticated
using(exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));
create policy sheet_drafts_admin_insert on public.sheet_template_drafts for insert to authenticated
with check(updated_by=(select auth.uid()) and exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));
create policy sheet_drafts_admin_update on public.sheet_template_drafts for update to authenticated
using(exists(select 1 from public.sheet_admins where user_id=(select auth.uid())))
with check(updated_by=(select auth.uid()) and exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));
create policy sheet_history_admin_select on public.sheet_template_history for select to authenticated
using(exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));
create policy sheet_history_admin_insert on public.sheet_template_history for insert to authenticated
with check(published_by=(select auth.uid()) and exists(select 1 from public.sheet_admins where user_id=(select auth.uid())));

create or replace function public.publish_sheet_template(p_template_key text)
returns integer language plpgsql security invoker set search_path=''
as $$
declare next_version integer; draft_fields jsonb;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.sheet_admins where user_id=(select auth.uid())) then
  raise exception 'Not permitted to publish templates' using errcode='42501';
 end if;
 if p_template_key<>'pf2e' then raise exception 'Unknown template' using errcode='22023'; end if;
 select fields into draft_fields from public.sheet_template_drafts
 where template_key=p_template_key for update;
 if draft_fields is null then raise exception 'Save a draft before publishing' using errcode='22023'; end if;
 if jsonb_typeof(draft_fields)<>'array' or jsonb_array_length(draft_fields) not between 1 and 650 then
  raise exception 'Invalid template fields' using errcode='22023';
 end if;
 insert into public.sheet_templates(template_key,fields,version) values(p_template_key,draft_fields,1)
 on conflict(template_key) do update set fields=excluded.fields,
 version=public.sheet_templates.version+1,updated_at=now()
 returning version into next_version;
 insert into public.sheet_template_history(template_key,version,fields,published_by)
 values(p_template_key,next_version,draft_fields,(select auth.uid()));
 return next_version;
end;
$$;
revoke all on function public.publish_sheet_template(text) from public,anon;
grant execute on function public.publish_sheet_template(text) to authenticated;
