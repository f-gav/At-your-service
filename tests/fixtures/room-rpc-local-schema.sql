-- Disposable PostgreSQL integration fixture. No production credentials/data.
-- Run only in a freshly provisioned empty Postgres 17 database.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
CREATE SCHEMA ays_rooms_private;

CREATE TABLE public.characters (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  system text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  system text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  closed boolean NOT NULL DEFAULT false
);
CREATE TABLE public.game_room_members (
  room_id uuid NOT NULL REFERENCES public.game_rooms(id),
  character_id uuid NOT NULL REFERENCES public.characters(id),
  user_id uuid NOT NULL,
  casts_enabled boolean NOT NULL DEFAULT true,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(room_id,character_id)
);
CREATE TABLE public.game_room_rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id),
  character_id uuid NOT NULL REFERENCES public.characters(id),
  user_id uuid NOT NULL,
  formula text NOT NULL,
  label text NOT NULL,
  total bigint NOT NULL,
  calculation text NOT NULL,
  dice jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION ays_rooms_private.room_snapshot(
  p_system text,p_name text,p_details jsonb
) RETURNS jsonb LANGUAGE sql STABLE SET search_path=''
AS $$ SELECT jsonb_build_object('name',p_name) $$;
REVOKE ALL ON FUNCTION ays_rooms_private.room_snapshot(text,text,jsonb)
 FROM public,anon;
REVOKE ALL ON public.characters,public.game_rooms,
 public.game_room_members,public.game_room_rolls FROM public,anon,authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.characters,public.game_rooms,public.game_room_members,
 public.game_room_rolls TO authenticated;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_rolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_characters ON public.characters FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY own_or_member_rooms ON public.game_rooms FOR SELECT TO authenticated
  USING (owner_id=(SELECT auth.uid()) OR EXISTS(
    SELECT 1 FROM public.game_room_members m WHERE m.room_id=id
      AND m.user_id=(SELECT auth.uid())
  ));
-- The two definer functions use the full SQL permission surface of production,
-- but direct inserts must remain forbidden to authenticated.
INSERT INTO public.characters(id,user_id,name,system)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Owner','pf2e'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Outsider','pf2e'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','Member','pf2e'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','44444444-4444-4444-8444-444444444444','Concurrent','pf2e'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','55555555-5555-4555-8555-555555555555','Wrong system','prmoon');
INSERT INTO public.game_rooms(id,owner_id,system,invite_code)
VALUES ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111','pf2e','ABCDEF12');
INSERT INTO public.game_room_members(room_id,character_id,user_id)
VALUES
 ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111'),
 ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '44444444-4444-4444-8444-444444444444');
COMMIT;
