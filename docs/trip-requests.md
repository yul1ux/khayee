# Trip requests

Customers can request to join a published trip from its detail page. Each
request includes a participant count and an optional message. Customers can
review their request history at `/account/requests` and cancel pending
requests. Organizers can review requests for their own published trips at
`/organizer/trips/requests`, including accepted participants and remaining
places for each trip.

Organizer request cards show the participant count and customer-provided
message. Customer profile details are not shared: the `profiles` read policy
allows users to read only their own profile. The workflow does not bypass that
privacy boundary.

The application uses the existing `trip_requests` table and RPC functions.
Authenticated inserts omit `customer_id` and `status`; the active baseline
trigger sets those values from the authenticated identity and validates trip
publication, departure time, ownership, and request size. A partial unique
index allows at most one pending or accepted request per customer and trip.
Organizers accept or reject requests through `accept_trip_request` and
`reject_trip_request`. Acceptance locks the trip row and checks total accepted
party size against capacity, so concurrent decisions cannot overbook. The
historical migration
[`0002_request_and_organizer_notifications.sql` (archived)](../supabase/archive/migrations/legacy-0001-0010/0002_request_and_organizer_notifications.sql)
records earlier notification changes that are incorporated into the active
baseline. The active migration set is documented in
[the database README](./database/README.md); repository files alone do not
establish remote migration status.

The automated action and component tests use mocked Supabase clients. Capacity
summary and request validation also have isolated unit tests. These tests do
not execute database RLS, triggers, row locks, notification triggers, or
concurrent acceptance. Verify those protections against an approved test
environment before production use.

## Manual verification

1. Sign in as a customer and open a published trip departing in the future.
2. Submit a request for multiple participants with an optional message.
3. Confirm the request appears as pending in **My requests** and in the
   organizer's request list.
4. Cancel the pending customer request. Confirm its status changes to
   cancelled and a new request can be submitted.
5. Submit another request and accept it as the trip's organizer. Confirm the
   customer sees the accepted status and that the organizer's request page
   reports accepted participants and remaining places.
6. Attempt acceptance when remaining capacity is insufficient; confirm the
   database rejects it and the request stays pending.
7. Verify a customer cannot decide another request, an organizer cannot cancel
   a customer's request, and a user cannot request their own trip.
