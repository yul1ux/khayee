# Admin moderation

The admin workspace at `/admin` is guarded in its server layout by the
authenticated session and the database-backed `admin` role. Each moderation
Server Action repeats the authorization check, validates form values, and
calls the existing SECURITY DEFINER RPC. Those RPCs independently verify the
caller role and perform the status transition, audit record, and associated
notifications transactionally. UI visibility is not an authorization control.

Organizer contact and review fields are read only from
`organizer_verification_details` in the protected admin area. Reports, trips,
and the audit log use the existing admin-only RLS policies. Customer profile
details are not exposed by the schema and are not retrieved here.

## Trip image previews

The baseline Storage read helper permits access to published trip images and
allows authenticated admins to create signed previews for unpublished images
without making those images public. The historical migration
[`0003_admin_trip_image_review.sql` (archived)](../supabase/archive/migrations/legacy-0001-0010/0003_admin_trip_image_review.sql)
describes the earlier introduction of this behavior; it is archived and is
not part of the active migration path. The current baseline scopes object
access to the private `trip-images` bucket and retains organizer ownership
checks for insert and delete. The local migration files alone do not prove
that a remote project's policies match; verify them in an approved test
environment before relying on pending-trip previews.

## Verification scope

The automated tests exercise route/action authorization decisions with mocked
Supabase clients and validate form behavior. They do not prove live RLS,
RPC permissions, audit writes, notification triggers, Storage policy behavior,
or database concurrency. Those require verification against an approved
Supabase test project.
