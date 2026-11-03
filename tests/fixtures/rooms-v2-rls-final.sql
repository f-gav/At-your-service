-- Disposable two-user acceptance on the existing isolated PostgreSQL fixture.
-- This is real SQL RLS with SET ROLE / auth.uid(), NOT two live Auth JWTs.
\set ON_ERROR_STOP on
BEGIN;
CREATE OR REPLACE FUNCTION ays_rooms_private.room_can_view(p_room uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.game_rooms r
  WHERE r.id=p_room AND (
    r.owner_id=(SELECT auth.uid())
    OR EXISTS(SELECT 1 FROM public.game_room_members m
              WHERE m.room_id=r.id AND m.user_id=(SELECT auth.uid()))
  )
 )
$$;
REVOKE ALL ON FUNCTION ays_rooms_private.room_can_view(uuid) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA ays_rooms_private TO authenticated;
GRANT EXECUTE ON FUNCTION ays_rooms_private.room_can_view(uuid) TO authenticated;
DROP POLICY own_or_member_rooms ON public.game_rooms;
CREATE POLICY rooms_participants_read ON public.game_rooms FOR SELECT TO authenticated
 USING (owner_id=(SELECT auth.uid()) OR ays_rooms_private.room_can_view(id));
CREATE POLICY members_participants_read ON public.game_room_members FOR SELECT TO authenticated
 USING (ays_rooms_private.room_can_view(room_id));
CREATE POLICY rolls_participants_read ON public.game_room_rolls FOR SELECT TO authenticated
 USING (ays_rooms_private.room_can_view(room_id));
CREATE POLICY rooms_owner_edit ON public.game_rooms FOR UPDATE TO authenticated
 USING (owner_id=(SELECT auth.uid())) WITH CHECK(owner_id=(SELECT auth.uid()));
CREATE POLICY rooms_owner_delete ON public.game_rooms FOR DELETE TO authenticated
 USING(owner_id=(SELECT auth.uid()));
CREATE POLICY members_self_or_owner_leave ON public.game_room_members FOR DELETE TO authenticated
 USING ((SELECT auth.uid())=user_id OR EXISTS(
  SELECT 1 FROM public.game_rooms r WHERE r.id=room_id AND r.owner_id=(SELECT auth.uid())
 ));
CREATE POLICY members_toggle_self ON public.game_room_members FOR UPDATE TO authenticated
 USING ((SELECT auth.uid())=user_id) WITH CHECK ((SELECT auth.uid())=user_id);
GRANT UPDATE(closed) ON public.game_rooms TO authenticated;
GRANT DELETE ON public.game_rooms,public.game_room_members TO authenticated;
GRANT UPDATE(casts_enabled) ON public.game_room_members TO authenticated;
-- Confirm anonymous Data API role cannot read the private tables.
DO $$
BEGIN
 IF has_table_privilege('anon','public.game_rooms','SELECT')
 OR has_table_privilege('anon','public.game_room_members','SELECT')
 OR has_table_privilege('anon','public.game_room_rolls','SELECT')
 THEN RAISE EXCEPTION 'Anonymous access to room data'; END IF;
END $$;
SET ROLE authenticated;
-- Account B is not a room participant; seeing any row is a cross-account leak.
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.game_rooms)
 OR EXISTS(SELECT 1 FROM public.game_room_members)
 OR EXISTS(SELECT 1 FROM public.game_room_rolls)
 THEN RAISE EXCEPTION 'Outsider can read room data'; END IF;
 IF EXISTS(SELECT 1 FROM public.characters WHERE user_id<>auth.uid())
 THEN RAISE EXCEPTION 'Outsider can read foreign character'; END IF;
END $$;
UPDATE public.game_rooms SET closed=true;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.game_rooms WHERE closed=true)
 THEN RAISE EXCEPTION 'Outsider changed owner settings'; END IF;
END $$;
DELETE FROM public.game_room_members;
-- Account C joined in the RPC fixture; participant can read the room, not edit it.
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.game_rooms)<>1
 OR (SELECT count(*) FROM public.game_room_members)<>3
 THEN RAISE EXCEPTION 'Participant cannot see shared compact room'; END IF;
 IF EXISTS(SELECT 1 FROM public.characters WHERE user_id<>auth.uid())
 THEN RAISE EXCEPTION 'Participant can read foreign character'; END IF;
END $$;
UPDATE public.game_rooms SET closed=true;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.game_rooms WHERE closed=true)
 THEN RAISE EXCEPTION 'Participant changed owner settings'; END IF;
END $$;
-- A participant cannot turn off another user's roll permission.
UPDATE public.game_room_members SET casts_enabled=false
 WHERE user_id='11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.game_room_members
   WHERE user_id='11111111-1111-4111-8111-111111111111' AND casts_enabled=false)
 THEN RAISE EXCEPTION 'Participant changed foreign roll permissions'; END IF;
END $$;
-- But own permission update must work.
UPDATE public.game_room_members SET casts_enabled=false
 WHERE user_id=auth.uid();
DO $$ BEGIN
 IF (SELECT count(*) FROM public.game_room_members WHERE user_id=auth.uid() AND casts_enabled=false)<>1
 THEN RAISE EXCEPTION 'Participant cannot update their own roll permission'; END IF;
END $$;
-- Account A owns the room and can close it.
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
UPDATE public.game_rooms SET closed=true;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.game_rooms WHERE closed=true)<>1
 THEN RAISE EXCEPTION 'Owner cannot change room settings'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
\echo PASS: isolated two-account room RLS, outsider denial, participant permissions, owner settings
