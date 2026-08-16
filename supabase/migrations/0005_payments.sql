-- Hisab: money tracked against an asset.
--
-- Attaches to an asset the same way documents do, so it works at whatever
-- level makes sense for the role: a payment against a property or deal for
-- Owner/Broker, against a unit or resident for Builder/Society (maintenance
-- dues, booking amounts, commission).
--
-- direction distinguishes money owed *to* you from money you owe out, so the
-- two never net against each other in the summary by accident.

create type public.payment_status as enum ('pending', 'received');
create type public.payment_direction as enum ('incoming', 'outgoing');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  direction public.payment_direction not null default 'incoming',
  status public.payment_status not null default 'pending',
  due_date date,
  settled_at timestamptz,
  note text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_asset_idx on public.payments(asset_id);

alter table public.payments enable row level security;

-- Same shape as the documents policies: these read `assets`, never `payments`
-- itself, so INSERT ... RETURNING is safe.
create policy "payments: read via asset access" on public.payments
  for select using (public.has_asset_access(asset_id));

create policy "payments: insert via asset access" on public.payments
  for insert with check (public.has_asset_access(asset_id));

create policy "payments: update via asset access" on public.payments
  for update using (public.has_asset_access(asset_id));

create policy "payments: owner deletes" on public.payments
  for delete using (
    exists (select 1 from public.assets a where a.id = asset_id and a.owner_id = auth.uid())
  );

create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();
