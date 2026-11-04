-- D&D Classic Rooms V2 — REVIEW ONLY. NOT APPLIED TO PRODUCTION.
-- Deliberately staged under supabase/proposals/, not migrations/.
-- Apply only after explicit schema approval, a verified DB+Storage backup,
-- and a green disposable PostgreSQL RLS/RPC acceptance run.
-- Existing RLS, RPC quotas, grants and PF2e/Project Moon snapshots stay intact.
BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.game_rooms'::regclass
      AND conname='game_rooms_system_check'
      AND contype='c'
      AND pg_get_constraintdef(oid) LIKE '%pf2e%'
      AND pg_get_constraintdef(oid) LIKE '%prmoon%'
  ) THEN
    RAISE EXCEPTION 'D&D Rooms: unexpected game_rooms system CHECK; abort without changes';
  END IF;
END
$guard$;

-- A room snapshot is an intentionally small, public-to-room-members view:
-- no sheet notes, spell descriptions, portrait URLs, inventory or JSON.
CREATE OR REPLACE FUNCTION ays_rooms_private.dnd_room_snapshot(
  p_name text,p_details jsonb
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $dnd$
DECLARE
  sheet jsonb:=p_details->'dnd5eSheet';
  hp_now integer;
  hp_max integer;
  hp_temp integer;
  lvl integer;
  dex integer;
  armor integer;
  shield_bonus integer;
  base_expression text;
  stat text;
BEGIN
  IF jsonb_typeof(sheet) IS DISTINCT FROM 'object'
    OR sheet->>'schemaVersion' IS DISTINCT FROM '1' THEN
    RETURN jsonb_build_object('name',left(coalesce(p_name,''),100));
  END IF;

  stat:=sheet#>>'{identity,level}';
  IF stat ~ '^[0-9]{1,2}$' THEN
    IF stat::integer BETWEEN 1 AND 20 THEN lvl:=stat::integer; END IF;
  END IF;
  stat:=sheet#>>'{combat,hp,current}';
  IF stat ~ '^[0-9]{1,7}$' THEN hp_now:=stat::integer; END IF;
  stat:=sheet#>>'{combat,hp,maximumBase}';
  IF stat ~ '^[0-9]{1,7}$' THEN hp_max:=stat::integer; END IF;
  stat:=sheet#>>'{combat,hp,temporary}';
  IF stat ~ '^[0-9]{1,7}$' THEN hp_temp:=stat::integer; END IF;

  -- Explicitly BASE armor only. Temporary effects, bonuses and armor features
  -- may change actual AC; never label this as the final combat value.
  base_expression:=sheet#>>'{combat,ac,baseExpression}';
  IF base_expression='10+[DEX]' THEN
    stat:=sheet#>>'{abilities,dex,score}';
    IF stat ~ '^[0-9]{1,2}$' THEN
      IF stat::integer BETWEEN 1 AND 30 THEN dex:=stat::integer; END IF;
    END IF;
    IF dex IS NOT NULL THEN armor:=10+floor((dex-10)/2.0)::integer; END IF;
  ELSIF base_expression ~ '^[0-9]{1,2}$' THEN
    IF base_expression::integer BETWEEN 1 AND 50 THEN armor:=base_expression::integer; END IF;
  END IF;
  IF armor IS NOT NULL AND sheet#>>'{combat,ac,shieldEquipped}'='true' THEN
    stat:=sheet#>>'{combat,ac,shieldBonus}';
    IF stat ~ '^[0-9]{1,2}$' THEN
      shield_bonus:=least(20,stat::integer);
      armor:=armor+shield_bonus;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'name',left(coalesce(p_name,''),100),
    'level',coalesce(lvl::text,''),
    'rulesEdition',CASE WHEN sheet->>'rulesEdition' IN ('2014','2024')
      THEN sheet->>'rulesEdition' ELSE '' END,
    'hpCurrent',coalesce(hp_now::text,''),
    'hpMax',coalesce(hp_max::text,''),
    'hpTemp',coalesce(hp_temp::text,''),
    'acBase',coalesce(armor::text,'')
  );
END
$dnd$;
REVOKE ALL ON FUNCTION ays_rooms_private.dnd_room_snapshot(text,jsonb)
  FROM PUBLIC,anon,authenticated;

DO $patch$
DECLARE
  current_snapshot text;
  current_join text;
  needle text:='return ''{}''::jsonb;';
  old_allowed text:='chosen.system not in (''pf2e'',''prmoon'')';
  new_allowed text:='chosen.system not in (''pf2e'',''prmoon'',''dnd5e'')';
BEGIN
  SELECT pg_get_functiondef(to_regprocedure(
    'ays_rooms_private.room_snapshot(text,text,jsonb)')) INTO current_snapshot;
  SELECT pg_get_functiondef(to_regprocedure(
    'public.join_game_room(text,uuid)')) INTO current_join;
  IF current_snapshot IS NULL OR current_join IS NULL
    THEN RAISE EXCEPTION 'D&D Rooms: base RPC/snapshot absent'; END IF;
  IF position(needle IN current_snapshot)=0
    OR position('p_system=''prmoon''' IN current_snapshot)=0
    OR position('p_system=''pf2e''' IN current_snapshot)=0
    THEN RAISE EXCEPTION 'D&D Rooms: unexpected room_snapshot implementation'; END IF;
  IF position(old_allowed IN current_join)=0
    THEN RAISE EXCEPTION 'D&D Rooms: unsupported join RPC revision; preserve quota checks'; END IF;
  -- Patch only the whitelist. In particular, do not replace a deployed
  -- rate-limited SECURITY DEFINER RPC with an older implementation.
  EXECUTE replace(current_snapshot,needle,
    'if p_system=''dnd5e'' then
       return ays_rooms_private.dnd_room_snapshot(p_name,p_details);
     end if;
     '||needle);
  EXECUTE replace(current_join,old_allowed,new_allowed);
END
$patch$;

ALTER TABLE public.game_rooms
  DROP CONSTRAINT game_rooms_system_check;
ALTER TABLE public.game_rooms
  ADD CONSTRAINT game_rooms_system_check
  CHECK (system IN ('pf2e','prmoon','dnd5e')) NOT VALID;
ALTER TABLE public.game_rooms VALIDATE CONSTRAINT game_rooms_system_check;

-- Retain the original RPC's private execution model and authenticated only access.
REVOKE ALL ON FUNCTION public.join_game_room(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_game_room(text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION ays_rooms_private.room_snapshot(text,text,jsonb)
  FROM PUBLIC,anon;

COMMIT;

-- Rollback plan (after removing any D&D memberships/rooms under operator control):
-- 1. Restore original join_game_room and room_snapshot definitions from backup.
-- 2. Reinstate CHECK (system IN ('pf2e','prmoon')) only after zero D&D rooms.
-- 3. DROP FUNCTION ays_rooms_private.dnd_room_snapshot(text,jsonb).
-- Do not run an automatic destructive downgrade.
