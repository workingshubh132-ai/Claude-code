-- The Vault: initial schema
-- Roles: owner, broker, builder, society
-- Backbone: a single self-referencing "assets" tree covers all four flavors:
--   Owner:   property (root, no children)          -> documents
--   Broker:  deal (root, no children)               -> documents
--   Builder: project (root) -> unit (child)         -> documents
--   Society: building (root) -> resident (child)    -> documents
-- Documents always attach to a leaf asset (property/deal/unit/resident) or
-- directly to a root asset when there's no nesting to speak of.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'broker', 'builder', 'society');
create type public.asset_type as enum ('property', 'deal', 'project', 'unit', 'building', 'resident');
create type public.document_status as enum ('missing', 'uploaded', 'verified');
create type public.collaborator_role as enum ('viewer', 'verifier');

-- one row per auth.users entry
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- the tree: properties, deals, projects, units, buildings, residents
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.assets(id) on delete cascade,
  type public.asset_type not null,
  name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_owner_idx on public.assets(owner_id);
create index assets_parent_idx on public.assets(parent_id);

-- enforce the two allowed nesting shapes at the DB layer, not just in the UI
create or replace function public.check_asset_nesting() returns trigger as $$
begin
  if new.type in ('property', 'deal', 'project', 'building') and new.parent_id is not null then
    raise exception 'asset type % must be a root (no parent)', new.type;
  end if;
  if new.type = 'unit' then
    if new.parent_id is null or (select type from public.assets where id = new.parent_id) <> 'project' then
      raise exception 'unit must have a project as its parent';
    end if;
  end if;
  if new.type = 'resident' then
    if new.parent_id is null or (select type from public.assets where id = new.parent_id) <> 'building' then
      raise exception 'resident must have a building as its parent';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger assets_nesting_check
  before insert or update on public.assets
  for each row execute function public.check_asset_nesting();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  name text not null,
  category text not null,
  status public.document_status not null default 'missing',
  expiry_date date,
  storage_path text,     -- full-size image, Supabase Storage object path
  thumbnail_path text,   -- compressed thumbnail, Supabase Storage object path
  uploaded_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_asset_idx on public.documents(asset_id);

-- authenticated collaborators (e.g. an invited broker/CA) scoped to one asset subtree
create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid references public.profiles(id),
  invited_email text,
  role public.collaborator_role not null default 'viewer',
  invited_by uuid not null references public.profiles(id),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  check (user_id is not null or invited_email is not null)
);
create index collaborators_asset_idx on public.collaborators(asset_id);
create index collaborators_user_idx on public.collaborators(user_id);

-- anonymous, scoped, expiring, revocable "verified share link"
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  token_hash text not null unique,
  label text,
  can_verify boolean not null default false,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  access_count integer not null default 0
);
create index share_links_asset_idx on public.share_links(asset_id);

create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger assets_touch before update on public.assets
  for each row execute function public.touch_updated_at();
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.assets enable row level security;
alter table public.documents enable row level security;
alter table public.collaborators enable row level security;
alter table public.share_links enable row level security;

create policy "profiles: self only" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- true if the current user owns this asset, or an ancestor of it, or holds an
-- active (accepted, unrevoked, unexpired) collaborator grant on it or an ancestor
create or replace function public.has_asset_access(target_asset_id uuid) returns boolean as $$
  with recursive chain as (
    select id, owner_id, parent_id from public.assets where id = target_asset_id
    union all
    select a.id, a.owner_id, a.parent_id
    from public.assets a
    join chain c on a.id = c.parent_id
  )
  select exists (select 1 from chain where owner_id = auth.uid())
    or exists (
      select 1
      from public.collaborators col
      join chain c on c.id = col.asset_id
      where col.user_id = auth.uid()
        and col.accepted_at is not null
        and col.revoked_at is null
        and (col.expires_at is null or col.expires_at > now())
    );
$$ language sql stable security definer;

create policy "assets: read via ownership or collaboration" on public.assets
  for select using (public.has_asset_access(id));
create policy "assets: owner inserts" on public.assets
  for insert with check (owner_id = auth.uid());
create policy "assets: owner updates" on public.assets
  for update using (owner_id = auth.uid());
create policy "assets: owner deletes" on public.assets
  for delete using (owner_id = auth.uid());

create policy "documents: read via asset access" on public.documents
  for select using (public.has_asset_access(asset_id));
create policy "documents: insert via asset access" on public.documents
  for insert with check (public.has_asset_access(asset_id));
create policy "documents: update via asset access" on public.documents
  for update using (public.has_asset_access(asset_id));
create policy "documents: owner deletes" on public.documents
  for delete using (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
  );

create policy "collaborators: asset owner manages" on public.collaborators
  for all using (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
  );
create policy "collaborators: invitee reads own invite" on public.collaborators
  for select using (user_id = auth.uid());

create policy "share_links: asset owner manages" on public.share_links
  for all using (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage: photos live in a private "documents" bucket, one folder per asset
-- Path convention: {asset_id}/{document_id}/full.jpg and {asset_id}/{document_id}/thumb.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents bucket: read via asset access"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and public.has_asset_access(((storage.foldername(name))[1])::uuid)
  );

create policy "documents bucket: write via asset access"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and public.has_asset_access(((storage.foldername(name))[1])::uuid)
  );

create policy "documents bucket: delete via ownership"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.assets a
      where a.id = ((storage.foldername(name))[1])::uuid
        and a.owner_id = auth.uid()
    )
  );
