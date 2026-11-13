# Notifications

The notification center at `/notifications` reads the signed-in user's inbox
through the existing `notifications_read_own` RLS policy. Mark-one and
mark-all actions derive the recipient from the authenticated server session,
update only `read_at`, and remain subject to `notifications_update_read_state_own`.
Clients cannot choose a recipient or create notifications.

The active baseline includes database functions and triggers for request
receipt, acceptance, rejection, request cancellation, organizer review
decisions, trip approval/rejection, and trip cancellation. The behavior
historically introduced by migrations
[`0004_notification_event_types.sql` (archived)](../supabase/archive/migrations/legacy-0001-0010/0004_notification_event_types.sql)
and
[`0005_notification_event_triggers.sql` (archived)](../supabase/archive/migrations/legacy-0001-0010/0005_notification_event_triggers.sql)
is incorporated into the active migration set, including customer
request-submission confirmation and admin alerts for new organizer
applications, trips submitted for review, and reports. Notifications are
inserted in the same transaction as their triggering database event.

## Migration status

The current active migration set is the baseline, published-trip access, and
emergency-contact INSERT grant under `supabase/migrations/`. Older numbered
migrations are retained under `supabase/archive/` for historical reference and
are not the active deployment chain. This repository does not establish which
migrations have been applied to a remote Supabase project; inspect that
project's migration ledger before deployment.

Automated tests cover action recipient filtering, read-state behavior, UI
states, event routing, and the migration trigger contract. The trigger
contract test checks migration source, not a live PostgreSQL execution; RLS,
trigger execution, role targeting, and transaction behavior still require
verification in an approved Supabase test project.
