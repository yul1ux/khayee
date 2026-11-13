import Link from "next/link";
import { notFound } from "next/navigation";
import { TripEditor, type TripValues } from "@/components/organizer/trip-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizerProfileId, requireSignedInUser } from "@/lib/organizer/access";
import { canEditOrganizerTrip } from "@/lib/organizer/trip-validation";

export const instant = false;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EditTripPageProps = {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ created?: string }>;
};

export default async function EditOrganizerTripPage({
  params,
  searchParams,
}: EditTripPageProps) {
  const [{ tripId }, query] = await Promise.all([params, searchParams]);
  if (!UUID_PATTERN.test(tripId)) notFound();

  const supabase = await createSupabaseServerClient();
  const user = await requireSignedInUser(supabase, `/organizer/trips/${tripId}/edit`);
  const profileId = await requireOrganizerProfileId(supabase, user.id);
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, organizer_profile_id, category_id, destination_id, title, summary, description, difficulty, duration_minutes, starts_at, ends_at, departure_location, capacity, price_mmk, safety_information, cancellation_policy, emergency_contact_information, included_services, excluded_services, required_equipment, status")
    .eq("id", tripId)
    .eq("organizer_profile_id", profileId)
    .maybeSingle();
  if (tripError) throw new Error("Could not load the trip.", { cause: tripError });
  if (!trip) notFound();

  const [categoriesResult, destinationsResult] = await Promise.all([
    supabase.from("trip_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("destinations").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (categoriesResult.error || destinationsResult.error) {
    throw new Error("Could not load trip categories and destinations.", {
      cause: categoriesResult.error ?? destinationsResult.error,
    });
  }

  const editable = canEditOrganizerTrip(trip.status);
  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/organizer/trips">Back to dashboard</Link>
      <p className="eyebrow mt-8 mb-3">Trip status: {trip.status.replaceAll("_", " ")}</p>
      <h1 className="section-title mb-8 text-[#27382c]">{editable ? "Edit trip" : "Trip details"}</h1>
      {query.created === "1" ? <p className="mb-6 border border-[#cbd6c0] bg-[#f0f3eb] p-3 text-sm text-[#31513b]">Draft created. Complete its details before submitting for review.</p> : null}
      {!editable ? (
        <p className="mb-8 max-w-2xl text-sm leading-6 text-[#73776e]">
          This trip cannot be edited in its current state. Submitted trips are reviewed by an administrator; published content changes use the separate trip revision workflow.
        </p>
      ) : (
        <TripEditor
          categories={categoriesResult.data ?? []}
          destinations={destinationsResult.data ?? []}
          trip={trip satisfies TripValues}
        />
      )}
    </main>
  );
}
