-- Allow optional per-element typography alongside the 16 existing Project Moon controls.
-- Keeps legacy 8/11/12/16 field layouts valid; authorization and versioning unchanged.
create or replace function public.publish_sheet_template(p_template_key text)
returns integer
language plpgsql
set search_path to ''
as $function$
declare
  next_version integer;
  draft_fields jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.sheet_admins where user_id=(select auth.uid())
  ) then
    raise exception 'Not permitted to publish templates' using errcode='42501';
  end if;
  if p_template_key not in ('pf2e', 'prmoon') then
    raise exception 'Unknown template' using errcode='22023';
  end if;
  select fields into draft_fields from public.sheet_template_drafts
  where template_key=p_template_key for update;
  if draft_fields is null then
    raise exception 'Save a draft before publishing' using errcode='22023';
  end if;
  if jsonb_typeof(draft_fields)<>'array' or jsonb_array_length(draft_fields) not between 1 and 650 then
    raise exception 'Invalid template fields' using errcode='22023';
  end if;
  if p_template_key='prmoon' and (
    jsonb_array_length(draft_fields) not in (8,11,12,16,17) or
    (select count(distinct item->>'id') from jsonb_array_elements(draft_fields) as item)<>jsonb_array_length(draft_fields) or
    exists (
      select 1 from jsonb_array_elements(draft_fields) as item
      where item->>'id' not in (
        'pagePadding','sectionGap','baseFont','titleFont',
        'attributeHeight','noteHeight','lineColor','inkColor',
        'portraitWidth','portraitShiftX','portraitShiftY','textStyles',
        'maskWidth','maskHeight','maskShiftX','maskShiftY','elementStyles'
      ) or item->'value' is null
    ) or
    (jsonb_array_length(draft_fields) in (12,16,17) and not exists (
      select 1 from jsonb_array_elements(draft_fields) as item
      where item->>'id'='textStyles' and jsonb_typeof(item->'value')='object'
    )) or
    (jsonb_array_length(draft_fields)=17 and not exists (
      select 1 from jsonb_array_elements(draft_fields) as item
      where item->>'id'='elementStyles' and jsonb_typeof(item->'value')='object'
    ))
  ) then
    raise exception 'Invalid Project Moon layout' using errcode='22023';
  end if;
  insert into public.sheet_templates(template_key,fields,version)
  values(p_template_key,draft_fields,1)
  on conflict(template_key) do update
    set fields=excluded.fields,
        version=public.sheet_templates.version+1,
        updated_at=now()
  returning version into next_version;
  insert into public.sheet_template_history(template_key,version,fields,published_by)
  values(p_template_key,next_version,draft_fields,(select auth.uid()));
  return next_version;
end;
$function$;
