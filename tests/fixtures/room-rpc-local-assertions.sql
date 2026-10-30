-- Actual PostgreSQL integration assertions against synthetic users only.
-- Run AFTER the staging proposal, against disposable test database.
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
DO $$
BEGIN
  IF has_function_privilege('anon',
    'public.join_game_room(text,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous may call join RPC'; END IF;
  IF has_function_privilege('anon',
    'public.post_game_room_roll(uuid,uuid,text,text,bigint,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous may post roll'; END IF;
  IF has_table_privilege('authenticated',
    'ays_rooms_private.room_rpc_quotas','INSERT') THEN
    RAISE EXCEPTION 'Client may directly edit quotas'; END IF;
  IF has_table_privilege('authenticated',
    'public.game_room_rolls','INSERT') THEN
    RAISE EXCEPTION 'Client can forge table roll'; END IF;
END; $$;

SET ROLE authenticated;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
DECLARE
  outcome uuid;
  remaining numeric;
BEGIN
  -- Start inside a 10s bucket, not at the rollover.
  remaining:=10-mod(extract(epoch from clock_timestamp()),10);
  IF remaining < 5 THEN PERFORM pg_sleep(remaining+0.05); END IF;

  IF (SELECT count(*) FROM public.characters
      WHERE user_id <> auth.uid())<>0
    THEN RAISE EXCEPTION 'RLS revealed foreign character'; END IF;
  outcome:=public.join_game_room('DEADBEAD','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  IF outcome IS NOT NULL THEN RAISE EXCEPTION 'Unknown room accepted'; END IF;
  outcome:=public.join_game_room('12345678','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  IF outcome IS NOT NULL THEN RAISE EXCEPTION 'Unknown room accepted twice'; END IF;
  outcome:=public.join_game_room('ABCDEF12','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  IF outcome IS NOT NULL THEN RAISE EXCEPTION 'Third join bypassed quota'; END IF;
END; $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT coalesce(sum(attempts),0)
     FROM ays_rooms_private.room_rpc_quotas
     WHERE user_id='22222222-2222-4222-8222-222222222222'
       AND operation='join') <> 2
 THEN RAISE EXCEPTION 'Failed attempts were rolled back'; END IF;
 IF EXISTS(SELECT 1 FROM public.game_room_members
    WHERE user_id='22222222-2222-4222-8222-222222222222')
 THEN RAISE EXCEPTION 'Quota-blocked member inserted'; END IF;
END; $$;

SET ROLE authenticated;
SET request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
DO $$
DECLARE outcome uuid;
BEGIN
  outcome:=public.join_game_room('ABCDEF12','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  IF outcome IS NOT NULL THEN RAISE EXCEPTION 'Foreign character joined room'; END IF;
  outcome:=public.join_game_room('ABCDEF12','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  IF outcome IS DISTINCT FROM '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
    THEN RAISE EXCEPTION 'Valid user could not join'; END IF;
END; $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.game_room_members
    WHERE user_id='33333333-3333-4333-8333-333333333333') <> 1
 THEN RAISE EXCEPTION 'Valid member not persisted'; END IF;
END; $$;

SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE i int; outcome uuid; remaining numeric;
BEGIN
 remaining:=10-mod(extract(epoch from clock_timestamp()),10);
 IF remaining < 5 THEN PERFORM pg_sleep(remaining+0.05); END IF;
 FOR i IN 1..10 LOOP
   outcome:=public.post_game_room_roll(
     '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
     '1d6','test',i,'1d6 = '||i,'[]'::jsonb);
   IF outcome IS NULL THEN RAISE EXCEPTION 'Valid roll # % denied',i; END IF;
 END LOOP;
 outcome:=public.post_game_room_roll(
   '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '1d6','test',11,'1d6 = 11','[]'::jsonb);
 IF outcome IS NOT NULL THEN RAISE EXCEPTION 'Eleventh roll bypassed quota'; END IF;
END; $$;
RESET ROLE;
DO $$
BEGIN
 IF (SELECT count(*) FROM public.game_room_rolls
  WHERE user_id='11111111-1111-4111-8111-111111111111')<>10
 THEN RAISE EXCEPTION 'Unexpected number of accepted rolls'; END IF;
 IF (SELECT coalesce(sum(attempts),0)
  FROM ays_rooms_private.room_rpc_quotas
  WHERE user_id='11111111-1111-4111-8111-111111111111'
    AND operation='roll')<>10
 THEN RAISE EXCEPTION 'Roll quota counter wrong'; END IF;
END; $$;
\echo PASS: PostgreSQL RPC permissions, same-window quotas, invalid-code accounting and ownership checks
