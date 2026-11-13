import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { CustomerRequestList, type CustomerTripRequest } from "@/components/trip-requests/request-management";

export const instant = false;

export default async function AccountRequestsPage() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError && !isUnauthenticatedSessionError(authError)) {
    throw new Error("Could not verify the current session.", { cause: authError });
  }
  if (!data.user) redirect("/login?next=%2Faccount%2Frequests");
  const user = data.user;
  const { data: requestRows, error: requestsError } = await supabase
    .from("trip_requests")
    .select("id, trip_id, party_size, message, status, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  if (requestsError) {
    throw new Error("Could not load your trip requests.", { cause: requestsError });
  }

  const tripIds = [...new Set((requestRows ?? []).map(({ trip_id }) => trip_id))];
  const tripsResult = tripIds.length > 0
    ? await supabase.from("trips").select("id, title, starts_at").in("id", tripIds)
    : { data: [], error: null };
  if (tripsResult.error) {
    throw new Error("Could not load your trip details.", { cause: tripsResult.error });
  }
  const tripsById = new Map((tripsResult.data ?? []).map((trip) => [trip.id, trip]));
  const requests: CustomerTripRequest[] = (requestRows ?? []).map((request) => {
    const trip = tripsById.get(request.trip_id);
    return {
      id: request.id,
      tripId: request.trip_id,
      tripTitle: trip?.title ?? null,
      startsAt: trip?.starts_at ?? null,
      partySize: request.party_size,
      message: request.message,
      status: request.status,
      createdAt: request.created_at,
    };
  });

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <div className="flex flex-wrap gap-5">
        <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/">Explore trips</Link>
        <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/account/reports">My reports</Link>
      </div>
      <p className="eyebrow mt-8 mb-3">Your account</p>
      <h1 className="section-title text-[#27382c]">My trip requests</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        Follow request decisions from organizers. Only pending requests can be cancelled.
      </p>
      <CustomerRequestList requests={requests} />
    </main>
  );
}
