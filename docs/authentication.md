# Authentication and organizer onboarding

## Registration

New accounts are created through Supabase Auth at `/signup`. The existing
`auth_user_created_profile` database trigger creates the `profiles` row and
assigns only the `customer` role. Application code does not write profile or
role rows during signup.

When email confirmation is enabled, signup does not treat the returned user as
an active session. It shows an inbox message instead. Supabase sends the
confirmation link to `/auth/callback`; the callback exchanges its one-time
code for a session, then sends the user to `/organizer/onboarding`.

Set `NEXT_PUBLIC_SITE_URL` to the canonical application origin in production,
for example `https://khayee.example`. Local development defaults to
`http://localhost:3000`. Add the exact `/auth/callback` URL to the Supabase
Auth redirect URL allowlist. Do not derive confirmation redirects from
untrusted request host headers.

## Organizer applications

The onboarding form writes only the existing `organizer_profiles` public
fields and the owner's `contact_email` in
`organizer_verification_details`. Inserting the organizer profile causes
existing database triggers to create the private details row and assign the
`organizer` role. The form never accepts or writes a role or verification
status.

The database defaults new applications to `pending`. Only the administrator
review RPC changes verification status and review metadata. Direct profile
updates keep the current verification state. The organizer profile and private
details rows are protected by existing RLS and column grants; application
actions use the signed-in user's Supabase SSR session.

## Trip authoring

Organizers can create draft trips, edit their own draft or rejected trips,
and submit through `submit_trip_for_review`. The database RLS policies and RPC
enforce ownership and status. Published content is not edited directly.
The baseline migration inserts the initial trip categories and destinations
needed for creation and search. Administrators curate those rows afterward.
The local Supabase seed runner is disabled; there is no separate `seed.sql`.
