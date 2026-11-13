import Link from "next/link";
import { OrganizerRequestList, type OrganizerTripRequest } from "@/components/trip-requests/request-management";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizerProfileId, requireSignedInUser } from "@/lib/organizer/access";
import { summarizeTripRequestCapacity } from "@/lib/trip-requests/capacity";

export const instant = false;

export default async function OrganizerTripRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const user = await requireSignedInUser(supabase, "/organizer/trips/requests");
  const profileId = await requireOrganizerProfileId(supabase, user.id);
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, title, status, capacity")
    .eq("organizer_profile_id", profileId);
  if (tripsError) {
    throw new Error("Could not load your trips.", { cause: tripsError });
  }

  const tripRows = trips ?? [];
  const tripTitles = new Map(tripRows.map((trip) => [trip.id, trip.title]));
  const tripIds = tripRows.map(({ id }) => id);
  const { data: requestRows, error: requestsError } = tripIds.length > 0
    ? await supabase
        .from("trip_requests")
        .select("id, trip_id, customer_id, party_size, message, status, created_at")
        .in("trip_id", tripIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (requestsError) {
    throw new Error("Could not load requests for your trips.", { cause: requestsError });
  }

  const requests: OrganizerTripRequest[] = (requestRows ?? []).map((request) => ({
    id: request.id,
    customerId: request.customer_id,
    tripTitle: tripTitles.get(request.trip_id) ?? "Published trip",
    partySize: request.party_size,
    message: request.message,
    status: request.status,
    createdAt: request.created_at,
  }));
  const tripCapacity = summarizeTripRequestCapacity(
    tripRows,
    (requestRows ?? []).map((request) => ({
      tripId: request.trip_id,
      partySize: request.party_size,
      status: request.status,
    })),
  );
  const pendingCount = requests.filter((request) => request.status === "pending").length;

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/organizer/trips">Back to dashboard</Link>
      <p className="eyebrow mt-8 mb-3">Organizer workspace</p>
      <h1 className="section-title text-[#27382c]">Trip requests</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}. Acceptances are checked against remaining trip capacity.
      </p>
      <OrganizerRequestList requests={requests} tripCapacity={tripCapacity} />
    </main>
  );
}
