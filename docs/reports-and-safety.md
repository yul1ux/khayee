# Reports and trip safety

Customers can report published trips and verified organizer profiles. An
organizer can report a customer only from a request on one of that
organizer's own trips. The server validates supported report categories and
target IDs, derives the reporter from the authenticated session, checks target
ownership/visibility, and prevents another pending report for the same
reporter, target, and category. Report descriptions are optional in the form;
the selected reason is stored as the required database details when omitted.
The existing RLS policy limits report reads to the reporter and admins.

The private `/account/reports` page shows the current user's reports and
statuses, without moderation notes or other users' identity. The admin report
queue supports status and category filters. Existing `resolve_report` remains
the only resolution path and transactionally records the admin action.
Submission alerts use the existing notification workflow. On resolution, the
reporter receives only a generic reviewed/closed notice; private notes and
report contents are not included.

Trip pages display the existing difficulty, duration, safety notes,
cancellation terms, required equipment, and included/excluded services.
Organizers manage these fields in the existing trip editor. Emergency contact
information was not present in the original schema, so migration
[`0006_trip_emergency_contact.sql` (archived)](../supabase/archive/migrations/legacy-0001-0010/0006_trip_emergency_contact.sql)
adds a bounded, optional field to trips and revisions. It is intentionally
visible on published trip pages; organizers are warned not to enter details
they do not consent to publish. The revision-approval trigger carries the
approved value into the published trip.

Outdoor activity carries risk. Listing these fields or verifying an organizer
does not guarantee safety. Users should review each trip and use their own
judgment.

## Migration and verification notes

The active baseline includes the emergency-contact trip fields and the partial
unique indexes that prevent duplicate pending reports for each supported
target. The separate active emergency-contact migration grants only
column-level `INSERT` on `emergency_contact_information`; it does not grant
table-wide `INSERT`. Earlier numbered SQL files are archived, not the active
migration chain. The current active migrations are listed in
[the database README](./database/README.md). Repository state does not prove
which migrations have been applied remotely.

The server checks for a duplicate pending report, and the baseline
[`0010_prevent_duplicate_pending_reports.sql` (archived)](../supabase/archive/migrations/legacy-0001-0010/0010_prevent_duplicate_pending_reports.sql)
shows the historical introduction of the partial indexes.

Tests for report submission and resolution are mocked Supabase tests. The
migration checks assert SQL source contracts, not actual PostgreSQL behavior.
Live RLS, report insertion/ownership, audit records, admin notifications,
and revision-trigger behavior need validation in an approved Supabase test
project.
