-- Fix active Storage policies that read the wrong "name" inside a correlated EXISTS.
-- Unqualified "name" referred to public.characters.name, not storage.objects.name.
-- This migration was also applied to production on 2026-10-10.
drop policy if exists "Portrait read own character" on storage.objects;
drop policy if exists "Portrait upload own character" on storage.objects;
drop policy if exists "Portrait delete own character" on storage.objects;

create policy "Portrait read own character" on storage.objects for select to authenticated
using (
  bucket_id = 'character-portraits'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.characters c
    where c.user_id = (select auth.uid())
      and c.id::text = (storage.foldername(storage.objects.name))[2]
  )
);

create policy "Portrait upload own character" on storage.objects for insert to authenticated
with check (
  bucket_id = 'character-portraits'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{32}-(card|sheet)[.]webp$'
  and exists (
    select 1 from public.characters c
    where c.user_id = (select auth.uid())
      and c.id::text = (storage.foldername(storage.objects.name))[2]
  )
);

create policy "Portrait delete own character" on storage.objects for delete to authenticated
using (
  bucket_id = 'character-portraits'
  and (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.characters c
    where c.user_id = (select auth.uid())
      and c.id::text = (storage.foldername(storage.objects.name))[2]
  )
);
