-- At your service! / Stage 1 read-only simulated RLS personas.
-- Requires an authorized SQL operator. No user IDs, names, JWTs or character data
-- are printed. Execute EACH BEGIN..ROLLBACK section separately if your editor
-- only displays its final result. Every section is transactionally read-only.
-- These tests mimic PostgreSQL authenticated role and auth.uid() context;
-- they do NOT replace two real JWT/API E2E tests.
--
-- Expected: all foreign_characters, foreign_portraits = 0.
-- Owner/participant see their room; outsider sees zero rooms/members/rolls.
-- Template draft/history visibility may legitimately differ for sheet_admins.

-- ===== owner =====
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub',(select owner_id::text from public.game_rooms order by created_at limit 1),true) IS NOT NULL AS persona_available;
SET LOCAL ROLE authenticated;
SELECT 'owner' AS persona, current_user='authenticated' AS expected_role,
  (select auth.uid() is not null) AS uid_present,
  (select count(*) from public.characters) AS visible_characters,
  (select count(*) from public.characters where user_id <> (select auth.uid())) AS foreign_characters,
  (select count(*) from storage.objects where bucket_id='character-portraits'
      and split_part(name,'/',1) <> (select auth.uid())::text) AS foreign_portraits,
  (select count(*) from public.game_rooms) AS visible_rooms,
  (select count(*) from public.game_room_members) AS visible_members,
  (select count(*) from public.game_room_rolls) AS visible_rolls,
  (select count(*) from public.sheet_template_drafts) AS visible_template_drafts,
  (select count(*) from public.sheet_template_history) AS visible_template_history;
ROLLBACK;

-- ===== participant =====
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub',(select m.user_id::text from public.game_room_members m join public.game_rooms r on r.id=m.room_id where m.user_id<>r.owner_id order by m.joined_at limit 1),true) IS NOT NULL AS persona_available;
SET LOCAL ROLE authenticated;
SELECT 'participant' AS persona, current_user='authenticated' AS expected_role,
  (select auth.uid() is not null) AS uid_present,
  (select count(*) from public.characters) AS visible_characters,
  (select count(*) from public.characters where user_id <> (select auth.uid())) AS foreign_characters,
  (select count(*) from storage.objects where bucket_id='character-portraits'
      and split_part(name,'/',1) <> (select auth.uid())::text) AS foreign_portraits,
  (select count(*) from public.game_rooms) AS visible_rooms,
  (select count(*) from public.game_room_members) AS visible_members,
  (select count(*) from public.game_room_rolls) AS visible_rolls,
  (select count(*) from public.sheet_template_drafts) AS visible_template_drafts,
  (select count(*) from public.sheet_template_history) AS visible_template_history;
ROLLBACK;

-- ===== outsider =====
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub',(select c.user_id::text from public.characters c where c.user_id not in (select owner_id from public.game_rooms union select user_id from public.game_room_members) group by c.user_id order by count(*) desc limit 1),true) IS NOT NULL AS persona_available;
SET LOCAL ROLE authenticated;
SELECT 'outsider' AS persona, current_user='authenticated' AS expected_role,
  (select auth.uid() is not null) AS uid_present,
  (select count(*) from public.characters) AS visible_characters,
  (select count(*) from public.characters where user_id <> (select auth.uid())) AS foreign_characters,
  (select count(*) from storage.objects where bucket_id='character-portraits'
      and split_part(name,'/',1) <> (select auth.uid())::text) AS foreign_portraits,
  (select count(*) from public.game_rooms) AS visible_rooms,
  (select count(*) from public.game_room_members) AS visible_members,
  (select count(*) from public.game_room_rolls) AS visible_rolls,
  (select count(*) from public.sheet_template_drafts) AS visible_template_drafts,
  (select count(*) from public.sheet_template_history) AS visible_template_history;
ROLLBACK;

-- ===== unauthenticated SQL permission surface =====
BEGIN READ ONLY;
SET LOCAL ROLE anon;
SELECT current_user='anon' AS expected_role,
  has_table_privilege(current_user,'public.characters','SELECT') AS can_read_characters,
  has_table_privilege(current_user,'public.game_rooms','SELECT') AS can_read_rooms,
  has_table_privilege(current_user,'public.game_room_members','SELECT') AS can_read_members,
  has_table_privilege(current_user,'public.game_room_rolls','SELECT') AS can_read_rolls,
  has_function_privilege(current_user,'public.join_game_room(text,uuid)','EXECUTE') AS can_call_join,
  has_function_privilege(current_user,'public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb)','EXECUTE') AS can_call_roll;
ROLLBACK;
