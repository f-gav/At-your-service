-- One optimized source image plus independent normalized crop rectangles.
-- Keep legacy card/sheet columns readable for earlier JSON imports and records.
alter table public.characters add column if not exists portrait_source_path text;
alter table public.characters add column if not exists portrait_crops jsonb;

alter table public.characters drop constraint if exists character_portrait_source_valid;
alter table public.characters add constraint character_portrait_source_valid check (
  (portrait_source_path is null and portrait_crops is null)
  or (
    portrait_source_path is not null
    and portrait_crops is not null and jsonb_typeof(portrait_crops)='object'
    and jsonb_typeof(portrait_crops->'card')='object'
    and jsonb_typeof(portrait_crops->'sheet')='object'
    and split_part(portrait_source_path,'/',1)=user_id::text
    and split_part(portrait_source_path,'/',2)=id::text
    and split_part(portrait_source_path,'/',3)~'^[0-9a-f]{32}-source[.]webp$'
    and portrait_source_path !~ '/.*/.*/'
  )
);

-- The previous policy restricted names to -card/-sheet. Allow only -source as well.
drop policy if exists "Portrait upload own character" on storage.objects;
create policy "Portrait upload own character" on storage.objects
for insert to authenticated with check (
  bucket_id = 'character-portraits'
  and (storage.foldername(storage.objects.name))[1]=(select auth.uid())::text
  and storage.filename(storage.objects.name) ~ '^[0-9a-f]{32}-(card|sheet|source)[.]webp$'
  and exists (select 1 from public.characters c
    where c.user_id=(select auth.uid())
    and c.id::text=(storage.foldername(storage.objects.name))[2])
);
