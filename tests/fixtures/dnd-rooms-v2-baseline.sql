-- CI-only fixtures for staged D&D Rooms V2.
-- PostgreSQL service has no production credentials and no genuine Auth JWTs.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE public.game_rooms ADD CONSTRAINT game_rooms_system_check
  CHECK (system IN ('pf2e','prmoon'));
CREATE OR REPLACE FUNCTION ays_rooms_private.room_snapshot(
  p_system text,p_name text,p_details jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=''
AS $$
BEGIN
  IF p_system='pf2e' THEN
    RETURN jsonb_build_object('name',p_name,'legacy','pf2e');
  ELSIF p_system='prmoon' THEN
    RETURN jsonb_build_object('name',p_name,'legacy','prmoon');
  END IF;
  return '{}'::jsonb;
END
$$;
REVOKE ALL ON FUNCTION ays_rooms_private.room_snapshot(text,text,jsonb) FROM PUBLIC,anon;
-- Production-like private membership check and refresh on character autosave.
CREATE OR REPLACE FUNCTION ays_rooms_private.room_refresh_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  UPDATE public.game_room_members m
     SET snapshot=ays_rooms_private.room_snapshot(new.system,new.name,new.details)
   WHERE m.character_id=new.id AND m.user_id=new.user_id;
  RETURN new;
END
$$;
CREATE TRIGGER room_refresh_on_character
AFTER UPDATE OF details,name ON public.characters
FOR EACH ROW EXECUTE FUNCTION ays_rooms_private.room_refresh_member();

CREATE OR REPLACE FUNCTION ays_rooms_private.room_can_view(p_room uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT EXISTS(SELECT 1 FROM public.game_rooms r WHERE r.id=p_room AND
   (r.owner_id=(SELECT auth.uid()) OR EXISTS(
      SELECT 1 FROM public.game_room_members m WHERE m.room_id=r.id AND m.user_id=(SELECT auth.uid()))))
$$;
REVOKE ALL ON FUNCTION ays_rooms_private.room_can_view(uuid) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA ays_rooms_private TO authenticated;
GRANT EXECUTE ON FUNCTION ays_rooms_private.room_can_view(uuid) TO authenticated;
DROP POLICY own_or_member_rooms ON public.game_rooms;
CREATE POLICY rooms_participants_read ON public.game_rooms FOR SELECT TO authenticated
 USING (owner_id=(SELECT auth.uid()) OR ays_rooms_private.room_can_view(id));
CREATE POLICY members_participants_read ON public.game_room_members FOR SELECT TO authenticated
 USING (ays_rooms_private.room_can_view(room_id));
CREATE POLICY rooms_owner_create ON public.game_rooms FOR INSERT TO authenticated
 WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY character_owner_update ON public.characters FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
GRANT INSERT ON public.game_rooms TO authenticated;
GRANT UPDATE(details,name) ON public.characters TO authenticated;
COMMIT;
\echo PASS: disposable PF/PM room snapshot baseline and two-user RLS installed
