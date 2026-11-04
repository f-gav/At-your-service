-- Disposable two-account (plus owner/outsider) D&D room acceptance.
-- Run after the staged-only proposal on CI PostgreSQL. No production users.
\set ON_ERROR_STOP on
BEGIN;
DO $preflight$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.join_game_room(text,uuid)'::regprocedure) INTO d;
  IF position('take_room_rpc_quota' IN d)=0 THEN
    RAISE EXCEPTION 'D&D migration removed server-side RPC quota'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.game_rooms'::regclass
    AND conname='game_rooms_system_check'
    AND pg_get_constraintdef(oid) LIKE '%dnd5e%')
    THEN RAISE EXCEPTION 'D&D system CHECK not installed'; END IF;
  IF has_function_privilege('anon','public.join_game_room(text,uuid)','EXECUTE')
    THEN RAISE EXCEPTION 'Anon gained privileged RPC'; END IF;
  IF has_table_privilege('authenticated','public.game_room_members','INSERT')
    THEN RAISE EXCEPTION 'Authenticated can directly forge membership'; END IF;
  IF ays_rooms_private.room_snapshot('pf2e','PF2e', '{}'::jsonb)->>'legacy' <> 'pf2e'
    THEN RAISE EXCEPTION 'PF2e snapshot regression'; END IF;
  IF ays_rooms_private.room_snapshot('prmoon','Project Moon', '{}'::jsonb)->>'legacy' <> 'prmoon'
    THEN RAISE EXCEPTION 'Project Moon snapshot regression'; END IF;
END
$preflight$;

INSERT INTO public.characters(id,user_id,name,system,details) VALUES
('a1111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Варвар D&D','dnd5e',
 '{"dnd5eSheet":{"schemaVersion":1,"rulesEdition":"2014","layoutEdition":"2014",
 "combat":{"hp":{"current":18,"maximumBase":24,"temporary":3},"ac":{"baseExpression":"10+[DEX]","shieldEquipped":false,"shieldBonus":2}},
 "abilities":{"dex":{"score":16}},"identity":{"level":4},
 "content":{"blocks":{"note1":"PRIVATE OWNER STORY MUST NOT LEAK"}}}}'),
('b1111111-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Бард D&D','dnd5e',
 '{"dnd5eSheet":{"schemaVersion":1,"rulesEdition":"2024","layoutEdition":"2024",
 "combat":{"hp":{"current":12,"maximumBase":19,"temporary":7},"ac":{"baseExpression":"10+[DEX]","shieldEquipped":true,"shieldBonus":2}},
 "abilities":{"dex":{"score":16}},"identity":{"level":3},
 "content":{"blocks":{"note1":"PRIVATE BARD STORY MUST NOT LEAK"}}}}'),
('c1111111-0000-4000-8000-000000000003','33333333-3333-4333-8333-333333333333','Колдун D&D','dnd5e',
 '{"dnd5eSheet":{"schemaVersion":1,"rulesEdition":"2024","layoutEdition":"2014",
 "combat":{"hp":{"current":21,"maximumBase":22,"temporary":0},"ac":{"baseExpression":"13","shieldEquipped":false,"shieldBonus":2}},
 "abilities":{"dex":{"score":12}},"identity":{"level":5},
 "content":{"blocks":{"note1":"PRIVATE WARLOCK BOOK MUST NOT LEAK"}}}}');

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
INSERT INTO public.game_rooms(id,owner_id,system,invite_code)
VALUES
 ('a1111111-aaaa-4aaa-8aaa-000000000001','11111111-1111-4111-8111-111111111111','dnd5e','D0D0AB12'),
 ('a1111111-aaaa-4aaa-8aaa-000000000002','11111111-1111-4111-8111-111111111111','dnd5e','D0D0CD34');
DO $owner$
BEGIN
 IF (SELECT count(*) FROM public.game_rooms WHERE system='dnd5e')<>2
   THEN RAISE EXCEPTION 'Owner cannot create D&D rooms'; END IF;
END
$owner$;

SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $outsider$
BEGIN
 IF EXISTS(SELECT 1 FROM public.game_rooms WHERE system='dnd5e')
    THEN RAISE EXCEPTION 'Outsider can discover private D&D room'; END IF;
END
$outsider$;
-- Existing PF2e character (user D) cannot join a D&D room.
DO $mismatch$
DECLARE result uuid;
BEGIN
 result:=public.join_game_room('D0D0AB12','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
 IF result IS NOT NULL THEN RAISE EXCEPTION 'Cross-system PF2e joined D&D room'; END IF;
END
$mismatch$;

SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $member$
DECLARE result uuid;
BEGIN
 result:=public.join_game_room('D0D0AB12','a1111111-0000-4000-8000-000000000001');
 IF result IS NOT NULL THEN RAISE EXCEPTION 'Foreign D&D character joined'; END IF;
 result:=public.join_game_room('D0D0AB12','b1111111-0000-4000-8000-000000000002');
 IF result IS DISTINCT FROM 'a1111111-aaaa-4aaa-8aaa-000000000001'::uuid
    THEN RAISE EXCEPTION 'Own 2024 character could not join 2014 owner room'; END IF;
END
$member$;

SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $multi$
DECLARE first_room uuid;second_room uuid;
BEGIN
 first_room:=public.join_game_room('D0D0AB12','c1111111-0000-4000-8000-000000000003');
 second_room:=public.join_game_room('D0D0CD34','c1111111-0000-4000-8000-000000000003');
 IF first_room IS DISTINCT FROM 'a1111111-aaaa-4aaa-8aaa-000000000001'::uuid
   OR second_room IS DISTINCT FROM 'a1111111-aaaa-4aaa-8aaa-000000000002'::uuid
   THEN RAISE EXCEPTION '2024 D&D character multi-room parity broken'; END IF;
END
$multi$;
DO $inspect$
DECLARE snap jsonb;
BEGIN
 SELECT m.snapshot INTO snap FROM public.game_room_members m
 WHERE m.room_id='a1111111-aaaa-4aaa-8aaa-000000000001' AND
 m.character_id='c1111111-0000-4000-8000-000000000003';
 IF snap->>'rulesEdition'<>'2024' OR snap->>'hpCurrent'<>'21'
   OR snap->>'acBase'<>'13' OR snap->>'level'<>'5'
   THEN RAISE EXCEPTION 'Incorrect D&D compact room snapshot %',snap; END IF;
 IF snap ? 'content' OR snap::text LIKE '%PRIVATE%' OR pg_column_size(snap)>4096
   THEN RAISE EXCEPTION 'Private sheet data leaked to room snapshot'; END IF;
 IF (SELECT count(*) FROM public.game_room_members
     WHERE character_id='c1111111-0000-4000-8000-000000000003')<>2
     THEN RAISE EXCEPTION 'Multi-room membership incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM public.characters WHERE user_id<>auth.uid())
   THEN RAISE EXCEPTION 'RLS exposed foreign character'; END IF;
END
$inspect$;

SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $shield$
DECLARE snap jsonb;
BEGIN
 SELECT snapshot INTO snap FROM public.game_room_members
 WHERE room_id='a1111111-aaaa-4aaa-8aaa-000000000001'
   AND character_id='b1111111-0000-4000-8000-000000000002';
 IF snap->>'acBase'<>'15' OR snap->>'hpTemp'<>'7' OR snap->>'rulesEdition'<>'2024'
   THEN RAISE EXCEPTION 'D&D shield/temporary HP snapshot incorrect: %',snap; END IF;
END
$shield$;
UPDATE public.characters
 SET details=jsonb_set(details,'{dnd5eSheet,combat,hp,current}','16'::jsonb),
 name='Бард D&D обновлён'
 WHERE id='b1111111-0000-4000-8000-000000000002';
DO $refresh$
DECLARE snap jsonb;
BEGIN
 SELECT snapshot INTO snap FROM public.game_room_members
 WHERE room_id='a1111111-aaaa-4aaa-8aaa-000000000001'
   AND character_id='b1111111-0000-4000-8000-000000000002';
 IF snap->>'hpCurrent'<>'16' OR snap->>'name'<>'Бард D&D обновлён'
   THEN RAISE EXCEPTION 'Realtime snapshot trigger did not refresh after autosave: %',snap; END IF;
END
$refresh$;

SET request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
DO $final$
BEGIN
 IF EXISTS(SELECT 1 FROM public.game_rooms WHERE system='dnd5e')
   OR EXISTS(SELECT 1 FROM public.game_room_members
     WHERE room_id IN ('a1111111-aaaa-4aaa-8aaa-000000000001',
                       'a1111111-aaaa-4aaa-8aaa-000000000002'))
  THEN RAISE EXCEPTION 'Outsider sees D&D memberships'; END IF;
END
$final$;
RESET ROLE;
ROLLBACK;
\echo PASS: disposable D&D Rooms V2 owner/outsider, foreign character, 2014/2024, multi-room, compact snapshot, auto-refresh and preserved quota
