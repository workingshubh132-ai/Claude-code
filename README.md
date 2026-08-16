# The Vault

Real estate document ledger — React + Vite, backed by Supabase (Postgres, Auth, Storage).

## Setup

1. Create a Supabase project.
2. Apply the schema: see `supabase/README.md` (either `supabase db push` or paste the files in `supabase/migrations/` into the SQL editor, in order).
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key.
4. `npm install`
5. `npm run dev`

## Status

Implemented: email/password auth with role selection (owner/broker/builder/society), the asset tree (property/deal/project/unit/building/resident) backed by Postgres with RLS, document CRUD, multiple photos per document (camera or gallery) compressed client-side and uploaded to Supabase Storage, hisab (money to receive / to pay, pending vs settled) per asset, and realtime updates for the currently open asset.

Not yet wired: the "generate verified share link" button is inert, and there's no collaborator-invite UI, even though `share_links` and `collaborators` exist in the schema. See `supabase/README.md` for the planned phases.

## Browser support

The build targets es2017 and `src/polyfills.js` patches `globalThis` and `Object.fromEntries`, which `supabase-js` uses and older Android WebViews lack. Without those, an old phone renders a blank page with no visible error. Keep the polyfill import first in `main.jsx`, and prefer widely-supported APIs in new code — `src/lib/id.js` exists because `crypto.randomUUID()` is missing below WebView 92.
