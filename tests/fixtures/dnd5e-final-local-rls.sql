-- Disposable two-account D&D character integration.
-- Runs ONLY inside the CI postgres:17 service after room fixtures are created.
-- Real SQL row-level security, JSONB size checks and CAS-style concurrency.
-- NOT Supabase Auth with two signed JWTs and NEVER production DB.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.characters ADD CONSTRAINT dnd_final_details_budget_check
  CHECK (jsonb_typeof(details)='object' AND pg_column_size(details)<=65536);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.characters TO authenticated;
CREATE POLICY dnd_final_insert ON public.characters FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY dnd_final_update ON public.characters FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY dnd_final_delete ON public.characters FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()));
INSERT INTO public.characters(id,user_id,name,system,details,updated_at)
VALUES
('aaaaaaaa-0000-4000-8000-000000000011','11111111-1111-4111-8111-111111111111','D&D A','dnd5e',
 '{"dnd5eSheet":{"schemaVersion":1,"rulesEdition":"2014","layoutEdition":"2014","content":{"blocks":{"note1":"A"}}}}}',
 '2026-01-01T00:00:00Z'),
('bbbbbbbb-0000-4000-8000-000000000022','22222222-2222-4222-8222-222222222222','D&D B','dnd5e',
 '{"dnd5eSheet":{"schemaVersion":1,"rulesEdition":"2024","layoutEdition":"2024","content":{"blocks":{"note1":"B"}}}}}',
 '2026-01-01T00:00:00Z');
SET ROLE authenticated;
SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
DO $$
DECLARE rows_seen int; changed int;
BEGIN
 SELECT count(*) INTO rows_seen FROM public.characters WHERE system='dnd5e';
 IF rows_seen<>1 THEN RAISE EXCEPTION 'Account A sees % DnD characters, expected one',rows_seen; END IF;
 UPDATE public.characters SET
  details=jsonb_set(details,'{dnd5eSheet,content,blocks,note1}','"new A"'::jsonb),
  updated_at='2026-01-02T00:00:00Z'
 WHERE id='aaaaaaaa-0000-4000-8000-000000000011'
  AND updated_at='2026-01-01T00:00:00Z';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Account A cannot save own DnD character'; END IF;
 -- A stale CAS revision must not overwrite a newer edit:
 UPDATE public.characters SET details='{}'
 WHERE id='aaaaaaaa-0000-4000-8000-000000000011'
  AND updated_at='2026-01-01T00:00:00Z';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Stale DnD write was accepted'; END IF;
 UPDATE public.characters SET name='Hijacked B'
 WHERE id='bbbbbbbb-0000-4000-8000-000000000022';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Account A edited account B'; END IF;
END $$;
SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
DO $$
DECLARE rows_seen int; changed int;
BEGIN
 SELECT count(*) INTO rows_seen FROM public.characters WHERE system='dnd5e';
 IF rows_seen<>1 THEN RAISE EXCEPTION 'Account B sees foreign DnD characters'; END IF;
 UPDATE public.characters SET details='{}'
 WHERE id='aaaaaaaa-0000-4000-8000-000000000011';
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Account B edited account A'; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE oversized jsonb;
BEGIN
 SELECT jsonb_build_object('note',string_agg(md5(g::text),''))
 INTO oversized FROM generate_series(1,7500) AS g;
 IF pg_column_size(oversized)<=65536
 THEN RAISE EXCEPTION 'Big-sheet test fixture unexpectedly small'; END IF;
 BEGIN
  INSERT INTO public.characters(id,user_id,name,system,details)
  VALUES('aaaaaaaa-0000-4000-8000-000000000033',
         '11111111-1111-4111-8111-111111111111','Oversized','dnd5e',oversized);
  RAISE EXCEPTION 'Oversized DnD sheet bypassed CHECK';
 EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: oversized D&D character rejected by JSONB CHECK';
 END;
END $$;
ROLLBACK;
\echo PASS: disposable SQL DnD two-user RLS, stale CAS, isolation and 64-KiB details budget
