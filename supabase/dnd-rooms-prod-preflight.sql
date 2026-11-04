-- Read-only production gate before D&D Rooms V2 migration.
-- Use with psql -X -v ON_ERROR_STOP=1 -f supabase/dnd-rooms-prod-preflight.sql
-- This file neither creates nor modifies any database object.
BEGIN READ ONLY;
WITH definitions AS (
 SELECT
   pg_get_functiondef(to_regprocedure('ays_rooms_private.room_snapshot(text,text,jsonb)')) AS snapshot,
   pg_get_functiondef(to_regprocedure('public.join_game_room(text,uuid)')) AS join_sql
), checks AS (
 SELECT
  position('return ''{}''::jsonb;' IN snapshot)>0 AS snapshot_fallback_unchanged,
  position('p_system=''prmoon''' IN snapshot)>0 AS prmoon_branch_present,
  position('p_system=''pf2e''' IN snapshot)>0 AS pf2e_branch_present,
  position('chosen.system not in (''pf2e'',''prmoon'')' IN join_sql)>0 AS join_whitelist_unchanged,
  (SELECT count(*)=1 FROM pg_constraint
    WHERE conrelid='public.game_rooms'::regclass
      AND conname='game_rooms_system_check'
      AND pg_get_constraintdef(oid) LIKE '%pf2e%'
      AND pg_get_constraintdef(oid) LIKE '%prmoon%') AS room_constraint_unchanged,
  (SELECT count(*)=0 FROM public.game_rooms WHERE system='dnd5e') AS no_dnd_rooms_yet,
  (SELECT count(*)=0 FROM public.game_room_members m
    JOIN public.game_rooms r ON r.id=m.room_id WHERE r.system='dnd5e') AS no_dnd_members_yet,
  NOT has_function_privilege('anon','public.join_game_room(text,uuid)','EXECUTE') AS anon_join_denied,
  has_function_privilege('authenticated','public.join_game_room(text,uuid)','EXECUTE') AS authenticated_join_allowed
 FROM definitions
)
SELECT * FROM checks;
COMMIT;
