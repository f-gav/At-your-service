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
 (select count(*) from public.characters where portrait_card_path is not null or portrait_sheet_path is not null) as legacy_portrait_references,
 (select count(*) from public.game_rooms) as game_rooms,
 (select count(*) from public.game_room_members) as room_members,
 (select count(*) from public.game_room_rolls) as room_rolls;

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

-- Stage 1 iteration 2: additional restore invariants for rooms and rolls.
-- Historical rolls may remain after a participant leaves: do not require
-- every old roll to have a current room-membership row.
select
  (select count(*) from public.game_room_members m
     left join public.game_rooms r on r.id=m.room_id
     left join public.characters c on c.id=m.character_id
     where r.id is null or c.id is null
       or c.user_id is distinct from m.user_id
       or c.system is distinct from r.system) as invalid_room_memberships,
  (select count(*) from public.game_room_rolls l
     left join public.game_rooms r on r.id=l.room_id
     left join public.characters c on c.id=l.character_id
     where r.id is null or c.id is null
       or l.user_id is distinct from c.user_id) as broken_room_roll_links,
  (select count(*) from public.game_room_members
     where snapshot is null or jsonb_typeof(snapshot)<>'object') as malformed_member_snapshots,
  (select count(*) from public.game_room_rolls
     where dice is null or jsonb_typeof(dice)<>'array') as malformed_roll_dice;
