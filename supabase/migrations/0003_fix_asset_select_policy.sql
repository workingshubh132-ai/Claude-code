-- Fix: every "add asset" insert failed with
--   42501: new row violates row-level security policy for table "assets"
--
-- Cause: the app inserts with `.select()` chained (INSERT ... RETURNING), and
-- PostgreSQL applies SELECT policies to rows returned that way. The SELECT
-- policy called has_asset_access(id), whose body re-queries public.assets for
-- that id -- but the row in question is the one being inserted by the current
-- statement, which is not visible to the function's snapshot yet. The lookup
-- found nothing, so access was denied and the insert was rejected.
--
-- Fix: check ownership directly against the new row's own column before
-- falling back to the tree walk. This is logically redundant -- has_asset_access
-- already treats a row's owner as having access -- but it evaluates without
-- reading the table back, so it works on a row that isn't visible yet.
-- Collaborator access through the asset tree is unchanged.

drop policy if exists "assets: read via ownership or collaboration" on public.assets;
create policy "assets: read via ownership or collaboration" on public.assets
  for select using (
    owner_id = auth.uid()
    or public.has_asset_access(id)
  );
