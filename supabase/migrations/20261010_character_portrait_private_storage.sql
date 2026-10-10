-- Private image storage for user-owned characters. Applied to production 2026-10-10.
alter table public.characters add column if not exists portrait_card_path text;
alter table public.characters add column if not exists portrait_sheet_path text;
alter table public.characters drop constraint if exists character_portrait_paths_valid;
alter table public.characters add constraint character_portrait_paths_valid check (
  (portrait_card_path is null and portrait_sheet_path is null)
  or (
    portrait_card_path is not null and portrait_sheet_path is not null
    and split_part(portrait_card_path, '/', 1) = user_id::text
    and split_part(portrait_sheet_path, '/', 1) = user_id::text
    and split_part(portrait_card_path, '/', 2) = id::text
    and split_part(portrait_sheet_path, '/', 2) = id::text
    and split_part(portrait_card_path, '/', 3) ~ '^[0-9a-f]{32}-card[.]webp$'
    and split_part(portrait_sheet_path, '/', 3) ~ '^[0-9a-f]{32}-sheet[.]webp$'
    and portrait_card_path !~ '/.*/.*/'
    and portrait_sheet_path !~ '/.*/.*/'
  )
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('character-portraits','character-portraits',false,450000,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=450000,
allowed_mime_types=array['image/webp'];
drop policy if exists "Portrait read own character" on storage.objects;
drop policy if exists "Portrait upload own character" on storage.objects;
drop policy if exists "Portrait delete own character" on storage.objects;
create policy "Portrait read own character" on storage.objects for select to authenticated
using (bucket_id='character-portraits'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.characters c where c.user_id=(select auth.uid())
  and c.id::text=(storage.foldername(name))[2])
);
create policy "Portrait upload own character" on storage.objects for insert to authenticated
with check (bucket_id='character-portraits'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and (storage.filename(name)) ~ '^[0-9a-f]{32}-(card|sheet)[.]webp$'
  and exists (select 1 from public.characters c where c.user_id=(select auth.uid())
  and c.id::text=(storage.foldername(name))[2])
);
create policy "Portrait delete own character" on storage.objects for delete to authenticated
using (bucket_id='character-portraits'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.characters c where c.user_id=(select auth.uid())
  and c.id::text=(storage.foldername(name))[2])
);
