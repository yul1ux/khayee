# Final MVP QA and production readiness

## Application architecture

Khayee uses the Next.js App Router with TypeScript and Tailwind CSS. Server
Components read marketplace and account data through cookie-backed Supabase
clients. Server Actions implement authenticated mutations; the organizer image
API route validates multipart uploads. Supabase Auth supplies user identity,
PostgreSQL is the source of truth for roles and trip state, and private Supabase
Storage holds trip images.

Implemented application workflows include:

- Signup, login, Auth callback, customer profile creation, organizer
  applications, and status display.
- Public trip discovery, search, filters, pagination, trip details, and
  customer trip requests.
- Organizer trip authoring, review submission, image management, request
  decisions, and safety information.
- Admin organizer/trip moderation, report resolution, and audit history.
- User-owned notifications and reports.

The presence of a page or a mocked test does not establish that its database,
Storage, or email integration works in a deployed Supabase project.

## Security boundaries

- The application uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in server and
  browser-safe Supabase clients. No service-role key is required or permitted
  in browser code.
- Server Actions derive the actor from the verified Supabase session. Privileged
  state changes use authorization-checked database RPCs.
- RLS and column grants constrain access to profiles, roles, organizer
  verification details, trips, requests, notifications, reports, and audit
  records. Storage is expected to remain a private bucket with policies
  restricting reads to published-trip images and writes to the owning
  organizer's editable trips.
- Admin routes check admin role server-side. RPCs independently check the
  caller before moderation and write audit records.
- The active baseline includes database triggers requiring verified organizers
  when trips or trip revisions enter review or approval states.

These are source-level design observations. RLS predicates, function
privileges, Storage policies, signed URL behavior, and transactions still
require verification against the actual deployed database and bucket.

## Environment and deployment requirements

Required application environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` in production for Auth confirmation redirects

Before deployment:

1. Reconcile and validate the SQL migration ledger as described below. Do not
   apply migrations from this repository until the deployed schema and ledger
   have been inspected.
2. Configure Supabase Auth email confirmation, the exact `/auth/callback`
   redirect allowlist, and production email delivery.
3. Configure the `trip-images` bucket as private with the expected MIME types,
   size limit, and reviewed Storage object policies. These Storage objects are
   managed separately from the SQL migrations.
4. The baseline migration inserts initial trip categories and destinations;
   administrators curate them afterward. Provision the first admin through a
   separately controlled trusted process. No user or admin accounts are seeded.
5. Set the canonical production origin, use HTTPS, and validate Auth and
   Storage behavior with test accounts in a non-production Supabase project.

## Active migration set

The current local deployment path is `supabase/migrations/` and contains these
three ordered migrations:

| Version | Purpose |
|---|---|
| `20261101162815` | Baseline schema, grants, RLS, RPCs, organizer-verification guards, and initial trip category/destination rows. |
| `20261102113109` | Public published-trip reads with authenticated owner/admin access preserved. |
| `20261113033037` | Column-level `INSERT` grant for `trips.emergency_contact_information`; it does not grant table-wide `INSERT`. |

Earlier numbered SQL files are retained under
`supabase/archive/migrations/legacy-0001-0010/` for historical reference and
are not the active migration chain. The local Supabase seed runner is disabled
because there is no separate seed file; the baseline migration contains the
initial lookup rows and does not create user accounts.

This repository state does not establish which migrations have been applied
to any remote Supabase project. Before deployment, inspect the target project's
migration ledger and schema read-only, reconcile them with this active set,
and use the approved release process. Do not replay or edit an applied
migration. No remote database change is made by this documentation.

## Test evidence and remaining integration work

The repository's Vitest tests are unit, component, SQL-source-contract, and
mocked Supabase tests. There are no live PostgreSQL/RLS, Storage-policy,
transaction-concurrency, Auth-email, or end-to-end integration tests in the
current test suite. In particular:

- Capacity tests do not prove row-lock behavior under concurrent database
  sessions.
- SQL-source-contract tests do not prove that migrations compile or execute.
- The baseline defines partial unique indexes for pending reports by target;
  SQL-source tests do not prove that those indexes exist in a remote database.
- Mocked repository tests do not prove deployed RLS or Storage authorization.
- Signup tests do not prove production email delivery or Auth redirect
  configuration.

Run disposable Supabase integration tests for RLS boundaries, organizer
verification gates, duplicate request constraints, concurrent acceptance,
notification triggers, report resolution, and image object access before
production launch. Never run destructive test cases against production data.
