-- At your service! / release 0.2.2
-- READ-ONLY integrity inventory: safe to execute against production.
-- This reports counts only, never user IDs, character details or object names.
-- Compare results with an independently restored, isolated test project.
-- A passing result is NOT proof of a usable backup.
select
 (select count(*) from public.characters) as characters,
 (select count(*) from public.sheet_admins) as admins,
 (select count(*) from public.sheet_templates) as published_templates,
 (select count(*) from public.sheet_template_drafts) as template_drafts,
 (select count(*) from public.sheet_template_history) as template_versions,
 (select count(*) from storage.objects where bucket_id='character-portraits') as portrait_objects,
 (select count(*) from public.characters where portrait_source_path is not null) as new_portrait_references,
 (select count(*) from public.characters where portrait_card_path is not null or portrait_sheet_path is not null) as legacy_portrait_references;

select
 (select count(*) from public.characters c
  where c.portrait_source_path is not null and not exists
   (select 1 from storage.objects o where o.bucket_id='character-portraits' and o.name=c.portrait_source_path))
   as missing_source_objects,
 (select count(*) from public.characters c
  where c.portrait_card_path is not null and not exists
   (select 1 from storage.objects o where o.bucket_id='character-portraits' and o.name=c.portrait_card_path))
   as missing_card_objects,
 (select count(*) from public.characters c
  where c.portrait_sheet_path is not null and not exists
   (select 1 from storage.objects o where o.bucket_id='character-portraits' and o.name=c.portrait_sheet_path))
   as missing_sheet_objects,
 (select count(*) from storage.objects o
  where o.bucket_id='character-portraits' and not exists
   (select 1 from public.characters c where o.name in
     (c.portrait_source_path,c.portrait_card_path,c.portrait_sheet_path)))
   as unreferenced_portrait_objects,
 (select count(*) from public.sheet_template_history h
  where not exists(select 1 from public.sheet_templates t where t.template_key=h.template_key))
   as versions_with_missing_template;

select 'characters' as entity, count(*) as total,
  count(*) filter(where details is null or jsonb_typeof(details)<>'object') as invalid_json
  from public.characters
union all select 'templates',count(*),
  count(*) filter(where fields is null or jsonb_typeof(fields)<>'array')
  from public.sheet_templates
union all select 'drafts',count(*),
  count(*) filter(where fields is null or jsonb_typeof(fields)<>'array')
  from public.sheet_template_drafts
union all select 'history',count(*),
  count(*) filter(where fields is null or jsonb_typeof(fields)<>'array')
  from public.sheet_template_history;
