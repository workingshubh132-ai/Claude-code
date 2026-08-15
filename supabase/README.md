# Supabase schema — The Vault

Apply the schema to a Supabase project:

```
supabase link --project-ref <your-project-ref>
supabase db push
```

or paste `migrations/0001_init.sql` into the SQL editor in the Supabase dashboard.

## Env vars the app will need

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Shape

- `profiles` — one row per `auth.users` entry, carries the role (`owner` / `broker` / `builder` / `society`).
- `assets` — self-referencing tree covering property, deal, project, unit, building, resident. Root types (`property`, `deal`, `project`, `building`) have no parent; `unit` must be parented to a `project`, `resident` to a `building`. Enforced by a trigger, not just app code.
- `documents` — always attached to an asset (leaf or root, depending on role). `storage_path` / `thumbnail_path` point at objects in the `documents` Storage bucket instead of storing base64.
- `collaborators` — authenticated, scoped grants (e.g. inviting a broker/CA to one property) with `viewer` / `verifier` roles, expiry, revocation.
- `share_links` — anonymous, scoped, expiring, revocable tokens for the "Generate verified share link" flow. Token is stored hashed; redemption should go through an Edge Function rather than direct table access.

Access control is centered on `has_asset_access(asset_id)`, a `security definer` SQL function that walks up the asset tree checking ownership or an active collaborator grant. All RLS policies on `assets`/`documents` call it, so granting access at any level of the tree (e.g. a whole project) implicitly grants it for everything nested underneath.
