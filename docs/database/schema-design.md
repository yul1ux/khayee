# Khayee database schema design

## Scope and conventions

The migration targets Supabase PostgreSQL with Supabase Auth and Storage
installed. All application tables are in `public`; helper functions that
bypass RLS are in a non-exposed `private` schema. The migration assumes
PostgREST exposes `public`, not `private`.

- UUIDs are used for user-linked and mutable business entities. Categories and
  destinations also use UUIDs so their identifiers remain opaque and stable.
- PostgreSQL enums are used for finite states and role/difficulty values:
  invalid values should fail at the database boundary. Category and
  destination values are rows instead because admins need to curate those
  lists without changing enum types.
- Time instants use `TIMESTAMPTZ`; defaults use the database clock.
- Prices are nonnegative `BIGINT` MMK values. No payment or currency
  conversion is represented.
- `created_at` and `updated_at` are present on mutable records. A shared
  `BEFORE UPDATE` trigger maintains `updated_at`; append-only role and audit
  records use `created_at` only.
- Arrays are limited to simple trip service/equipment lists. Notifications
  and audit details use JSONB only where their payload shape is intentionally
  extensible; JSON is not used for core relational data.
- The name `trip` always means a published offer or its organizer-owned
  draft, not a reservation. A `trip_request` is the request for places on it.
- The browser uses only the public/anon or authenticated Supabase key. A
  `service_role` credential is server-only and is not part of this design.

## Entities and relationships

| Entity | Purpose and important relationships |
|---|---|
| `profiles` | One-to-one with `auth.users` using the same UUID. Private user-editable profile fields; automatically created on Auth signup. |
| `user_roles` | Zero or more roles per Auth user (`customer`, `organizer`, `admin`); composite primary key prevents duplicate assignments. Customer role is assigned at signup and organizer role when the user creates an organizer profile. Only admins can directly manage role rows. |
| `organizer_profiles` | Optional one-to-one public profile owned by an Auth user. Contains display name, bio, website, and verification status. Public display fields and status are visible for verified profiles; owner identity is used for authorization but is not granted for public selection. |
| `organizer_verification_details` | One-to-one private extension of `organizer_profiles`. Contains organizer contact email and verification reviewer, timestamp, and rejection reason. Only the associated organizer and admins can read it; the organizer can update only their contact email, while the admin review RPC writes review fields. Cascades when its organizer profile is deleted. |
| `trip_categories` | Admin-curated category lookup referenced by trips. The baseline migration inserts the initial categories; admins curate them afterward. |
| `destinations` | Admin-curated Myanmar destination lookup referenced by trips. Includes optional coordinates and region. The baseline migration inserts initial destinations; admins curate them afterward. |
| `trips` | An organizer-owned offer with one category and destination. Has authoring, review, publication, and cancellation state. Trips reference an organizer profile with `ON DELETE RESTRICT`; deleting an organizer cannot silently orphan trips. |
| `trip_images` | Ordered image metadata for a trip, using a Storage object path rather than a duplicated URL. Trip deletion cascades metadata; object cleanup is not automatic. |
| `trip_requests` | A customer's request for a party size on a trip. A trip and customer can have historical requests, but only one pending/accepted request at a time. Requests cascade with trip or customer deletion. |
| `notifications` | Recipient-owned inbox entries, optionally associated with a trip and request. Users may read and mark their own notifications as read. |
| `reports` | A report by a user targeting exactly one trip, organizer profile, or user. The report's target and reporter are foreign-keyed. Resolution is admin-only. |
| `admin_actions` | Append-only audit records for privileged role, reference-data, trip, revision, organizer-verification, and report actions. `target_id` is polymorphic and therefore intentionally has no target FK; `target_kind` identifies the target type. |
| `trip_revisions` | A proposed content snapshot for an already-published trip. Approval atomically applies that snapshot to the trip; history remains in this table. One pending revision per trip. |

### Relationship sketch

```text
auth.users 1--1 profiles
auth.users 1--* user_roles
profiles 1--0..1 organizer_profiles 1--1 organizer_verification_details
organizer_profiles 1--* trips
trip_categories 1--* trips *--1 destinations
trips 1--* trip_images
trips 1--* trip_requests *--1 auth.users
auth.users 1--* notifications
auth.users 1--* reports
trips 1--* trip_revisions
auth.users 1--* admin_actions
```

`trip_requests.party_size` is the number of people represented by that
request. Capacity is derived from the sum of party sizes for requests whose
status is `accepted`; there is deliberately no `available_seats` column.

### Foreign-key deletion behavior

| Relationship | `ON DELETE` | Reason |
|---|---|---|
| `profiles.user_id`, `user_roles.user_id`, `trip_requests.customer_id`, `notifications.recipient_id`, `reports.reporter_id` -> `auth.users.id` | `CASCADE` | User-owned profile, role, request, inbox, and report data follows account deletion. |
| `organizer_profiles.user_id` -> `profiles.user_id` | `CASCADE` | Organizer profile is an optional extension of the profile. |
| `organizer_verification_details.organizer_profile_id` -> `organizer_profiles.id` | `CASCADE` | Private verification details exist only for their organizer profile. |
| `organizer_verification_details.reviewed_by` -> `auth.users.id` | `SET NULL` | Preserve review timestamp and rejection reason if a reviewer account is deleted. |
| `trips.organizer_profile_id` -> `organizer_profiles.id` | `RESTRICT` | Do not orphan trips or bypass trip retention when deleting an organizer. |
| Trip and revision category/destination references -> lookup IDs | `RESTRICT` | Retain lookup values referenced by trip content. Deactivate rather than delete in normal operations. |
| `trip_images.trip_id`, `trip_requests.trip_id`, `trip_revisions.trip_id` -> `trips.id` | `CASCADE` | Child metadata belongs to the trip. Storage object deletion remains a separate cleanup task. |
| `notifications.trip_id`, `notifications.trip_request_id` -> trip/request IDs | `SET NULL` | Preserve inbox history when the related entity is removed. |
| `reports.trip_id`, `reports.organizer_profile_id`, `reports.target_user_id` -> report targets | `CASCADE` | Remove a report whose target no longer exists. Exactly-one-target constraint remains valid. |
| `trip_revisions.submitted_by` -> `auth.users.id` | `RESTRICT` | Preserve revision attribution; account deletion must be handled deliberately. |
| `reviewed_by` fields -> `auth.users.id`, `admin_actions.actor_id` -> `auth.users.id` | `SET NULL` | Keep reviewed records and audit history if an actor account is deleted. |

## Statuses and allowed transitions

Statuses are enum-constrained. The migration does not permit clients to write
workflow status columns directly; RPCs perform privileged transitions after
checking the caller and locking relevant rows.

### Organizer verification

`pending -> verified | rejected`; an administrator may re-review a rejected
profile. Rejection requires a nonblank reason. The public
`organizer_profiles.verification_status` holds the status; private
`organizer_verification_details` holds `contact_email`, `reviewed_by`,
`reviewed_at`, and `verification_rejection_reason`. The
`review_organizer_profile` admin-only RPC updates the public status and private
review fields together, under locks and in one transaction. Organizers can
read their own details and update only `contact_email`; admins can read details
and change review metadata through the RPC. No anon policy or public column
grant exposes private details. This status is independent of trip approval.
The migration does not assume that organizer verification automatically
approves or blocks a trip; an administrator makes each decision separately.

### Trips

```text
draft -> pending_review -> published
                      \-> rejected -> pending_review
draft | pending_review | rejected | published -> cancelled
published -> completed  (reserved status; no completion RPC in this MVP)
```

- Only `submit_trip_for_review` moves an owner's draft/rejected trip to
  `pending_review`.
- Only admins can approve/reject `pending_review` trips. Rejection requires a
  reason. Approval changes the trip to `published`.
- Approval rechecks that departure is in the future and that the selected
  category and destination are active.
- Only `published` trips are visible to unauthenticated users.
- Organizers may edit only their own `draft` or `rejected` trip through direct
  table writes. Pending and published content is frozen.
- Any published-trip content change, including capacity, must be proposed as
  a `trip_revision` and approved by an admin. An approved revision is applied
  in one transaction. It cannot reduce capacity below the currently accepted
  party size or change a trip to a departure time in the past.
- Published image metadata and Storage objects are immutable in this initial
  workflow. To avoid bypassing trip review, image replacement for published
  trips is not supported until a future revision design includes image
  snapshots.
- Organizers can cancel their own nonterminal trips using `cancel_trip`.
  Pending and accepted requests are changed to cancelled and customers are
  notified. Cancellation is not a request cancellation and does not implement
  refunds.

### Trip requests

```text
pending -> accepted | rejected | cancelled
accepted -> cancelled (only as part of cancelling the trip)
rejected | cancelled -> terminal; a new request row may be submitted
```

- A customer may cancel only their own pending request.
- Organizers may accept or reject pending requests for their own trips.
- A request cannot be created after the trip's `starts_at`; the insert trigger
  rechecks this condition while holding the trip row lock.
- The partial unique index on `(trip_id, customer_id)` for `pending` and
  `accepted` enforces one active request. Rejected/cancelled requests do not
  block a later request.
- The insert trigger assigns `customer_id` from `auth.uid()` and locks/rechecks
  the trip to serialize submission against trip cancellation or departure.
- Accepted requests count by `party_size`; the database rejects acceptance
  that would exceed trip capacity.

### Trip revisions and reports

- Revision: `draft -> pending_review -> approved | rejected`; rejected
  revisions are terminal. An owner can prepare a new revision. Approval and
  rejection are admin-only and rejection requires a reason.
- Report: `pending -> reviewed | dismissed`; only an admin can resolve it.
  Resolution is auditable.

## Constraints and security rules

- `profiles.user_id` references `auth.users`; a safe Auth trigger creates a
  profile and customer role on signup.
- Every organizer profile insert creates a corresponding private
  `organizer_verification_details` row through a fixed-search-path,
  authorization-checking trigger function. The private row is deleted with
  its organizer profile. Profile creation is intended to run with the
  authenticated owner's JWT; service-role-only inserts without `auth.uid()`
  are rejected by this trigger.
- Customers are assigned on Auth signup; creating an organizer profile
  transactionally assigns the organizer role. Direct role-row reads are
  self/admin only, and direct inserts/deletes are admin-only. Admin role
  changes are audited. Initial admin bootstrap is a trusted operator task
  outside this migration.
- An organizer profile is owned by one user. Trips and image mutations are
  checked against that owner, not a client-supplied organizer identity.
- Category and destination foreign keys prevent trips from referencing
  arbitrary free-text values.
- Trip checks enforce nonblank required text, positive duration/capacity,
  valid time ordering, nonnegative MMK price, and rejection reasons.
- The accepted-seat invariant is not expressible as a simple `CHECK` because
  it spans request rows. `accept_trip_request` enforces it while holding a
  lock on the trip row. All accept operations for one trip serialize on that
  row; direct client status updates are denied.
- Foreign keys use `CASCADE` only where dependent data should disappear with
  its owner (profiles, requests, image/revision metadata). Organizer profile
  deletion is restricted while trips reference it. Category/destination
  deletion is restricted while trips use them. Audit actor deletion sets the
  actor to NULL so history remains.
- Report targets use three nullable FKs plus a `num_nonnulls(...) = 1` check,
  ensuring one target exactly.
- The `trip-images` bucket is private and was provisioned through the Storage
  API. The migration intentionally makes no changes to
  Supabase-managed `storage.objects` or `storage.buckets`: its remote migration
  role does not own those tables, so enabling RLS or creating policies there
  would fail. The failed `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`
  was removed along with the direct bucket insert and policy DDL.

  The three policies below are configured in the linked project through
  Supabase Storage policy management and were verified remotely on
  2026-10-31. If setting up another environment, create them through Supabase
  Dashboard > Storage > Policies (or another supported owner-authorized path):

  - `trip_images_storage_read_published`: `SELECT` for `anon` and
    `authenticated` where `bucket_id = 'trip-images'` and
    `private.is_published_trip_image(name)` is true.
  - `trip_images_storage_insert_own_editable`: `INSERT` for `authenticated`
    where `bucket_id = 'trip-images'` and
    `private.can_manage_trip_image_object(name)` is true.
  - `trip_images_storage_delete_own_editable`: `DELETE` for `authenticated`
    where `bucket_id = 'trip-images'` and
    `private.can_manage_trip_image_object(name)` is true.

  Object paths are `<trip-uuid>/<object-uuid>.<extension>`. There is no update
  policy; replacement or modification is not permitted. Inspect for an
  existing bucket or policy before creating one; reuse only if its privacy
  setting and policy expression match these rules. Never work around Storage
  ownership restrictions by changing ownership or RLS on platform-managed
  tables.

  Linked-project verification on 2026-10-31 confirmed that `trip-images` is
  private, has a 50 MiB file limit, allows `image/jpeg`, `image/png`, and
  `image/webp`, and uses enabled Storage RLS. All three policies were present
  with the expected commands, roles, and helper predicates. The linked SQL
  connection runs as `postgres`, not the `storage.objects` owner; do not
  attempt policy DDL through the application migration role or a non-owner SQL
  connection.

## RLS policy inventory

All application tables have RLS enabled. The policies below are the complete
initial migration policy set for application tables. SQL grants further limit
which columns and operations are reachable through PostgREST. Supabase Storage
policies are not created by this migration and must be configured separately
as described above.

| Table | `anon` | `authenticated` |
|---|---|---|
| `profiles` | No access | `profiles_select_own`, `profiles_update_own`: select/update own profile only; allowed update columns exclude identity and timestamps. |
| `user_roles` | No access | `user_roles_select_own_or_admin`, `user_roles_insert_admin_only`, `user_roles_delete_admin`: select own roles; only admins may directly insert/delete roles. Auth and organizer-profile triggers assign default roles. |
| `organizer_profiles` | `organizer_profiles_read_public_or_owner_or_admin`: select verified rows, limited to public display columns | Same public read; owners can also read their own profile. `organizer_profiles_insert_self` and `organizer_profiles_update_owner` allow owners to create/update public profile fields only. Verification status is changed only by the admin RPC. |
| `organizer_verification_details` | No access | `organizer_verification_details_read_owner_or_admin` and `organizer_verification_details_update_contact_owner`: owner/admin may read their associated private details; owner may update `contact_email` only. Review metadata has no direct UPDATE grant and is changed only by the admin RPC. |
| `trip_categories` | Select active categories | `trip_categories_read_active_or_admin`, `trip_categories_manage_admin`: select active categories; admins can manage all rows. |
| `destinations` | Select active destinations | `destinations_read_active_or_admin`, `destinations_manage_admin`: select active destinations; admins can manage all rows. |
| `trips` | Select `published` trips only | `trips_read_published_owner_or_admin`, `trips_insert_own_draft`, `trips_update_own_editable`: select published, own, or admin-visible trips; organizer inserts own drafts and updates own drafts/rejections. Review fields are excluded from direct update grants. |
| `trip_images` | Read metadata for published trips | `trip_images_read_published_owner_or_admin`, `trip_images_insert_own_editable`, `trip_images_update_own_editable`, `trip_images_delete_own_editable`: read published, own, or admin-visible metadata; organizer writes only own draft/rejected trips. |
| `trip_requests` | No access | `trip_requests_read_customer_trip_owner_or_admin`, `trip_requests_insert_own_pending`: customers select own requests and insert eligible pending requests; trip owners select their trip requests; admins can select all. Status changes use RPCs. |
| `notifications` | No access | `notifications_read_own`, `notifications_update_read_state_own`: select/update own notifications only; recipients cannot create or delete notifications. |
| `reports` | No access | `reports_read_own_or_admin`, `reports_insert_own_pending`: reporter/admin can select; authenticated users can insert pending reports for another target; resolution uses an admin RPC. |
| `admin_actions` | No access | `admin_actions_read_admin`: admins can select. No API role can insert, update, or delete audit rows. |
| `trip_revisions` | No access | `trip_revisions_read_owner_or_admin`, `trip_revisions_insert_owner_draft`, `trip_revisions_update_owner_editable`: trip owner/admin can select; owner can insert/edit draft or rejected snapshots for their published trip. Workflow status changes use RPCs. |
| `storage.objects` in `trip-images` | Not configured by this migration; create policies through Supabase Dashboard > Storage > Policies after bucket provisioning. | Required separate policies permit reading matching published trip images and insert/delete only by the owner of a draft/rejected trip. No object update policy. |

Notifications have no admin-read exception: even admins may read only their
own notifications. Admin-only workflow functions create notifications for
their intended recipient.

## RPC functions

Every workflow RPC is `SECURITY DEFINER` only because it must atomically
perform a transition unavailable to table clients. Each has a fixed
`search_path` of `pg_catalog`, schema-qualified object references, explicit
`auth.uid()`/role/ownership checks, and transaction-scoped row locks where
needed. Execute is revoked from `PUBLIC` and `anon` and granted only to
`authenticated`.

| Function | Authorization and effect |
|---|---|
| `submit_trip_for_review(trip_id)` | Owning organizer; validates editable status and future departure, then submits a draft/rejected trip. |
| `approve_trip(trip_id)` | Admin only; locks a pending trip, publishes it, records reviewer/audit entry, and notifies the organizer. |
| `reject_trip(trip_id, reason)` | Admin only; locks a pending trip, requires a reason, records reviewer/audit entry, and notifies the organizer. |
| `submit_trip_revision_for_review(revision_id)` | Owning organizer; submits a draft/rejected revision for an already-published trip. |
| `approve_trip_revision(revision_id)` | Admin only; locks the trip then revision, verifies departure/capacity, applies snapshot, and audits approval. |
| `reject_trip_revision(revision_id, reason)` | Admin only; locks trip then revision, requires a reason, and audits rejection. |
| `accept_trip_request(request_id)` | Owning organizer; locks trip then request, counts accepted party sizes, checks capacity and departure, accepts and notifies customer. |
| `reject_trip_request(request_id)` | Owning organizer; locks trip then request, rejects a pending request, and notifies customer. |
| `cancel_trip_request(request_id)` | Requesting customer; locks trip then request and cancels only a pending request. |
| `cancel_trip(trip_id, reason)` | Owning organizer; cancels a nonterminal trip, cancels active requests, and notifies affected customers. |
| `review_organizer_profile(organizer_profile_id, status, reason)` | Admin only; locks the public organizer profile and private verification-details row, updates the public verification status plus private reviewer/timestamp/rejection reason atomically, and audits the result. Rejection requires a reason. |
| `resolve_report(report_id, status, notes)` | Admin only; resolves a pending report as reviewed/dismissed and records an audit row. |

`submit_trip_request` is intentionally not an RPC in this initial design:
customers insert only a pending request through a tightly scoped RLS policy,
column grant, and `BEFORE INSERT` trigger. The trigger assigns the caller as
customer and locks the trip while rechecking publication, departure, capacity,
and self-request rules. The partial unique index and constraints enforce
request uniqueness and shape; decision transitions remain RPC-only.

## Index inventory and rationale

Primary keys and unique constraints create their own indexes. Additional
indexes support public trip filtering, RLS relationship checks, active
request enforcement, and moderation queues:

- Constraint-backed indexes: `profiles_pkey`; `user_roles_pkey`;
  `organizer_profiles_pkey`, `organizer_profiles_user_id_key`;
  `organizer_verification_details_pkey`;
  `trip_categories_pkey`, `trip_categories_slug_key`;
  `destinations_pkey`, `destinations_slug_key`; `trips_pkey`;
  `trip_images_pkey`, `trip_images_storage_path_key`,
  `trip_images_trip_sort_order_unique`; `trip_requests_pkey`;
  `notifications_pkey`; `reports_pkey`; `trip_revisions_pkey`;
  `admin_actions_pkey`.
- `user_roles_role_user_idx`: lookup users by role.
- `organizer_profiles_verification_status_idx`: admin verification queue.
- `trip_categories_active_sort_idx`: ordered active category list.
- `destinations_region_name_idx`: destination browsing by region/name.
- `trips_organizer_status_created_idx`: organizer dashboard and moderation.
- `trips_public_start_idx`: published trip discovery ordered by departure.
- `trips_public_destination_start_idx`: published destination/date filters.
- `trips_public_category_start_idx`: published category/date filters.
- `trip_requests_one_active_per_customer_trip_idx`: uniqueness for active
  requests per customer/trip.
- `trip_requests_trip_status_created_idx`: organizer request queue and
  accepted-capacity reads.
- `trip_requests_customer_created_idx`: customer request history.
- `notifications_recipient_created_idx`: recipient inbox ordering.
- `notifications_unread_recipient_created_idx`: unread inbox filter.
- `reports_status_created_idx`: admin moderation queue.
- `reports_reporter_created_idx`: reporter's own reports.
- `admin_actions_target_created_idx`: audit lookup for a target.
- `admin_actions_actor_created_idx`: audit lookup by administrator.
- `trip_revisions_trip_status_created_idx`: trip revision history/review.
- `trip_revisions_one_pending_per_trip_idx`: prevents concurrent pending
  revisions for one trip.

Partial indexes omit non-public or non-active rows where the corresponding
lookup filters on those states. No index is added for a hypothetical
search-engine workload; add full-text/geospatial indexes only after the actual
query plan and product requirements are known.

## Assumptions and deferred decisions

1. A request represents `party_size` participants; it is not implicitly one
   person. This makes capacity math explicit.
2. Request insertion is customer-only; organizer/admin workflows do not create
   a customer's request on their behalf.
3. Organizer verification and trip approval are separate. A verified
   organizer is not automatically approved, and the migration does not impose
   verification as an unstated prerequisite for trip submission/publication.
4. Any published content change, including capacity, requires an approved
   revision. Published image replacement is frozen pending a revision-image
   snapshot design.
5. Trip cancellation cancels pending and accepted requests and does not model
   refunds, rescheduling, or a separate customer withdrawal of an accepted
   request.
6. A trusted process must mark trips `completed`; the enum is included but a
   completion RPC/cron policy is deferred.
7. Rejected organizer verification can be reviewed again by an admin. A
   separate organizer resubmission workflow is not modeled.
8. Category/destination reference values, localized/Myanmar-language fields,
   phone normalization, report retention, account deletion policy, and
   storage cleanup are intentionally not invented or seeded here.
9. Deleting a trip's database metadata does not delete its Storage objects;
   a trusted cleanup job should be added only with a defined retention and
   audit policy.

## Migration and naming

- Migration files use zero-padded numeric order and descriptive snake case,
  for example `0002_add_trip_languages.sql`.
- Schemas and tables use `snake_case`; primary keys are `id` except the
  one-to-one `profiles.user_id`; foreign keys use `<entity>_id`.
- Constraints, indexes, policies, and triggers use descriptive
  `<table>_<purpose>_<kind>` names.
- Functions use action-oriented `snake_case` names and named `p_` parameters.
- Never edit an already-applied migration. Add a forward migration and update
  this document when behavior changes.
- Keep all workflow and audit writes in the same database transaction. Avoid
  external network calls in migrations/functions.