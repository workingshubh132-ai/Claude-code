-- Builder-specific features: unit sale status, construction milestones,
-- milestone-linked payments, and RERA/compliance fields.
--
-- Sale status and RERA fields go directly on `assets` rather than a side
-- table, continuing the pattern already used there (metadata jsonb, the type
-- enum itself): the tree stays the one backbone table, extended with nullable
-- columns that only apply to particular types (status/buyer_* for 'unit',
-- rera_number/possession_date for 'project'). Nothing reads these for other
-- types, so they stay null there.

create type public.unit_status as enum ('available', 'booked', 'sold');

-- No column-level default: a DEFAULT here would apply to every asset type
-- (property, deal, project, building too, not just unit), which would make
-- them all show up as "status: available" and get miscounted by the
-- inventory summary that only makes sense for units. Instead the app sets
-- status: 'available' explicitly at insert time for type = 'unit' only
-- (see createAsset's `extra` param), leaving it genuinely null elsewhere.
alter table public.assets
  add column status public.unit_status,
  add column buyer_name text,
  add column buyer_phone text,
  add column rera_number text,
  add column possession_date date;

-- Construction milestones. Attaches to an asset the same way documents and
-- payments do -- in practice a project's own milestones, but nothing stops a
-- unit from having its own finishing checklist if a builder wants that.
create type public.milestone_status as enum ('pending', 'in_progress', 'completed');

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  name text not null,
  status public.milestone_status not null default 'pending',
  sequence integer not null default 0,
  planned_date date,
  completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_asset_idx on public.milestones(asset_id, sequence);

alter table public.milestones enable row level security;

-- Same shape as documents/payments: these read `assets`, never `milestones`
-- itself, so INSERT ... RETURNING doesn't hit the trap fixed in migration 0003.
create policy "milestones: read via asset access" on public.milestones
  for select using (public.has_asset_access(asset_id));

create policy "milestones: insert via asset access" on public.milestones
  for insert with check (public.has_asset_access(asset_id));

create policy "milestones: update via asset access" on public.milestones
  for update using (public.has_asset_access(asset_id));

create policy "milestones: owner deletes" on public.milestones
  for delete using (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
  );

create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();

-- Let a hisab entry optionally reference the construction stage it's due
-- against ("20% on booking, 30% on slab casting") instead of only a free-text
-- description.
alter table public.payments
  add column milestone_id uuid references public.milestones(id) on delete set null,
  add column percent numeric(5, 2) check (percent is null or (percent >= 0 and percent <= 100));
