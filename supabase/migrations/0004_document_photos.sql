-- Multiple photos per document.
--
-- documents carried a single storage_path/thumbnail_path pair, so a document
-- could only ever hold one image. Move photos into a child table so a deed can
-- have all its pages under one entry. The old columns stay (nothing reads them
-- after the backfill below) rather than being dropped, so existing rows and any
-- older client keep working.
--
-- Storage path convention is now:
--   {asset_id}/{document_id}/{photo_id}/full.jpg
--   {asset_id}/{document_id}/{photo_id}/thumb.jpg
-- The bucket policies key off the first path segment (asset_id), so the extra
-- nesting needs no policy change.

create table public.document_photos (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  storage_path text not null,
  thumbnail_path text not null,
  position integer not null default 0,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index document_photos_document_idx on public.document_photos(document_id, position);

alter table public.document_photos enable row level security;

-- Access follows the parent document's asset. Note these look up `documents`,
-- never `document_photos` itself, so INSERT ... RETURNING works: the row being
-- inserted is never the row the policy has to read back.
create policy "document_photos: read via asset access" on public.document_photos
  for select using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.has_asset_access(d.asset_id)
    )
  );

create policy "document_photos: insert via asset access" on public.document_photos
  for insert with check (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.has_asset_access(d.asset_id)
    )
  );

create policy "document_photos: update via asset access" on public.document_photos
  for update using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.has_asset_access(d.asset_id)
    )
  );

create policy "document_photos: delete via asset access" on public.document_photos
  for delete using (
    exists (
      select 1 from public.documents d
      where d.id = document_id and public.has_asset_access(d.asset_id)
    )
  );

-- Carry any already-uploaded photo over so nothing disappears from the UI.
insert into public.document_photos (document_id, storage_path, thumbnail_path, position, uploaded_by)
select id, storage_path, thumbnail_path, 0, uploaded_by
from public.documents
where storage_path is not null
  and thumbnail_path is not null;
