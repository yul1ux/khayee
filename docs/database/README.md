# Khayee database

This directory documents the PostgreSQL data model and its security boundary
for Khayee, a request-based outdoor trip marketplace launching in Mandalay,
Myanmar. Supabase Auth is the source of user identity;
PostgreSQL constraints, Row Level Security (RLS), and narrowly scoped RPC
functions enforce the business rules. The browser must never receive a
Supabase `service_role` key.

## Required workflow for database changes

> Before modifying the database, inspect the existing schema, read this documentation, create a new migration, and never modify an already-applied migration.

1. Read [schema-design.md](./schema-design.md) and inspect the current database
   and migration history before proposing a change.
2. Add a new, ordered SQL migration under `supabase/migrations/`; do not edit a
   migration that has already been applied in any environment.
3. Keep the migration additive where possible. If a change needs a backfill,
   document its ordering, locking, rollback, and deployment implications.
4. Review grants, RLS policies, function ownership, `search_path`, and every
   status transition affected by the change. Never rely on frontend checks for
   authorization.
5. Validate SQL against a local Supabase/PostgreSQL instance or CI database.
   Do not apply migrations to a remote database as part of implementation
   unless that action is explicitly requested and separately approved.
6. Update this documentation and the relationship, index, policy, and workflow
   inventories in [schema-design.md](./schema-design.md).

## Files

- [schema-design.md](./schema-design.md): entities, relationships, invariants,
  RLS, RPCs, indexing, and decisions.
- Active migrations are ordered in
  [supabase/migrations](../../supabase/migrations/). The current migration set
  includes the baseline, published-trip access, and emergency-contact INSERT
  privilege.

## Current repository notes

- The migration expects a Supabase-managed `auth` schema.
- Public organizer display data and verification state are stored in
  `organizer_profiles`; private contact and review metadata are stored in
  `organizer_verification_details`. Only the profile owner and admins can read
  verification details.
- The baseline defines the three Khayee Storage object policies for the
  private `trip-images` bucket; bucket provisioning and deployed policy state
  must still be verified per environment. Do not alter ownership or RLS on
  Supabase-managed Storage tables.
- Organizer image uploads use the signed-in user's cookie-backed Supabase
  session, never a service-role key. The server verifies organizer access and
  editable trip status; database RLS and Storage policies enforce ownership
  again. The app allows at most 10 images per trip and bounds upload request
  bodies before multipart parsing.
- The baseline inserts initial trip categories and destinations. It does not
  create Auth users or administrator accounts; administrators curate reference
  data through the application.
- The first administrator must be provisioned by a trusted database operator
  through a separately controlled process. Users cannot grant themselves the
  `admin` role through the application API.
- Repository migrations do not establish remote migration status; inspect the
  target project's schema and migration ledger before deployment.

## Notes for future AI coding agents

- Treat the SQL migration as the source of truth for constraints and
  authorization. Check the actual deployed schema and migration ledger too;
  repository state alone does not prove which migrations have run.
- Never update a user's role, a trip's review status, or a request's decision
  from a frontend query. Use the policies and RPCs documented here.
- Use `auth.uid()` as the authenticated identity. Do not trust a client-supplied
  actor, owner, reviewer, status, or capacity count.
- For any new user-facing table, enable RLS, add least-privilege table/column
  grants, and document each `anon` and `authenticated` policy before adding
  application code.
- Functions that bypass RLS must use a fixed safe `search_path`, fully
  qualify objects, explicitly authorize the caller, validate transition
  preconditions, and write audit/notification records in the same transaction
  when relevant.
- Keep public trip content safe to expose. Do not include private profile,
  organizer verification, report, or moderation data in public queries.
- Do not add a separately maintained seat counter. Accepted party sizes are
  the capacity source of truth.
- Do not add secrets, production records, or a `service_role` key to source
  files, browser bundles, migrations, or documentation.