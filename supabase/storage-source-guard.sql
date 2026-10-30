-- READ-ONLY: fail closed if live private portrait Storage policy drifts
-- from the local recovery policies in proposals/local-restore-portrait-storage.sql.
-- Emits only PASS/FAIL; does not expose paths or private content.
WITH policies AS (
  SELECT policyname,cmd,roles,qual,with_check
  FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname LIKE 'Portrait %'
),
bucket AS (
  SELECT id,public,file_size_limit,allowed_mime_types
  FROM storage.buckets WHERE id='character-portraits'
)
SELECT CASE WHEN
 (SELECT count(*)=3 FROM policies)
 AND (SELECT count(*)=1 FROM bucket WHERE public=false
      AND file_size_limit=450000
      AND allowed_mime_types=ARRAY['image/webp']::text[])
 AND EXISTS(SELECT 1 FROM policies
   WHERE policyname='Portrait read own character' AND cmd='SELECT'
     AND 'authenticated'::name=ANY(roles)
     AND qual ILIKE '%foldername%' AND qual ILIKE '%auth.uid%')
 AND EXISTS(SELECT 1 FROM policies
   WHERE policyname='Portrait upload own character' AND cmd='INSERT'
     AND 'authenticated'::name=ANY(roles)
     AND with_check ILIKE '%foldername%' AND with_check ILIKE '%source%')
 AND EXISTS(SELECT 1 FROM policies
   WHERE policyname='Portrait delete own character' AND cmd='DELETE'
     AND 'authenticated'::name=ANY(roles)
     AND qual ILIKE '%foldername%' AND qual ILIKE '%auth.uid%')
THEN 'PASS' ELSE 'FAIL' END;
