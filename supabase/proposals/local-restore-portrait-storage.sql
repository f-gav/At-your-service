-- LOCAL DOCKER RESTORE ONLY: managed Storage schema configuration.
-- Mirrors the audited production character-portraits bucket and policies as
-- of 2026-10-30. This file is NOT in supabase/migrations.
-- Never execute on production or the unrelated WreckTrack project.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('character-portraits','character-portraits',false,450000,ARRAY['image/webp'])
ON CONFLICT(id) DO UPDATE
SET public=false,file_size_limit=450000,allowed_mime_types=ARRAY['image/webp'];

DROP POLICY IF EXISTS "Portrait read own character" ON storage.objects;
DROP POLICY IF EXISTS "Portrait upload own character" ON storage.objects;
DROP POLICY IF EXISTS "Portrait delete own character" ON storage.objects;

CREATE POLICY "Portrait read own character" ON storage.objects FOR SELECT TO authenticated
USING (
 bucket_id='character-portraits'
 AND (storage.foldername(storage.objects.name))[1]=(SELECT auth.uid())::text
 AND EXISTS (
   SELECT 1 FROM public.characters c
   WHERE c.user_id=(SELECT auth.uid())
     AND c.id::text=(storage.foldername(storage.objects.name))[2]
 )
);
CREATE POLICY "Portrait upload own character" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
 bucket_id='character-portraits'
 AND (storage.foldername(storage.objects.name))[1]=(SELECT auth.uid())::text
 AND storage.filename(storage.objects.name) ~ '^[0-9a-f]{32}-(card|sheet|source)[.]webp$'
 AND EXISTS (
   SELECT 1 FROM public.characters c
   WHERE c.user_id=(SELECT auth.uid())
     AND c.id::text=(storage.foldername(storage.objects.name))[2]
 )
);
CREATE POLICY "Portrait delete own character" ON storage.objects FOR DELETE TO authenticated
USING (
 bucket_id='character-portraits'
 AND (storage.foldername(storage.objects.name))[1]=(SELECT auth.uid())::text
 AND EXISTS (
   SELECT 1 FROM public.characters c
   WHERE c.user_id=(SELECT auth.uid())
     AND c.id::text=(storage.foldername(storage.objects.name))[2]
 )
);
COMMIT;
