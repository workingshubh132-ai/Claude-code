# The Vault

Real estate document ledger — React + Vite, backed by Supabase (Postgres, Auth, Storage).

## Setup

1. Create a Supabase project.
2. Apply the schema: see `supabase/README.md` (either `supabase db push` or paste the files in `supabase/migrations/` into the SQL editor, in order).
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key.
4. `npm install`
5. `npm run dev`

## Status

Implemented: email/password auth with role selection (owner/broker/builder/society), the asset tree (property/deal/project/unit/building/resident) backed by Postgres with RLS, document CRUD, photo capture compressed client-side and uploaded to Supabase Storage, and realtime updates for the currently open asset.

Not yet wired: the "generate verified share link" button is still a mock UUID (no `share_links` row is created) and there's no collaborator-invite UI yet, even though both tables exist in the schema. See `supabase/README.md` for the planned phases.
