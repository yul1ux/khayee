import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { TripImageManager } from "@/components/organizer/trip-image-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrganizerTripImagesPageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function OrganizerTripImagesPage({
  params,
}: OrganizerTripImagesPageProps) {
  const { tripId } = await params;
  if (!UUID_PATTERN.test(tripId)) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError && !isUnauthenticatedSessionError(userError)) {
    throw new Error("Could not verify the current session.", {
      cause: userError,
    });
  }
  if (!userData.user) {
    redirect(`/login?next=${encodeURIComponent(`/organizer/trips/${tripId}/images`)}`);
  }

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (rolesError) {
    throw new Error("Could not load organizer permissions.", {
      cause: rolesError,
    });
  }

  const roleNames = (roles ?? []).map(({ role }) => role);
  if (!roleNames.includes("organizer") || roleNames.includes("admin")) {
    notFound();
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, title, status")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError) {
    throw new Error("Could not load the trip.", { cause: tripError });
  }
  if (!trip) {
    notFound();
  }

  if (trip.status !== "draft" && trip.status !== "rejected") {
    return (
      <main className="page-shell min-h-[65vh] py-12 sm:py-16">
        <Link
          className="text-sm font-semibold text-[#35503a] underline underline-offset-4"
          href="/organizer/trips"
        >
          Back to trips
        </Link>
        <h1 className="section-title mt-8 text-[#27382c]">{trip.title}</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[#73776e]">
          Images cannot be changed while a trip is pending review, published,
          cancelled, or completed.
        </p>
      </main>
    );
  }

  const { data: images, error: imagesError } = await supabase
    .from("trip_images")
    .select("id, alt_text, sort_order")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });

  if (imagesError) {
    throw new Error("Could not load trip images.", { cause: imagesError });
  }

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link
        className="text-sm font-semibold text-[#35503a] underline underline-offset-4"
        href="/organizer/trips"
      >
        Back to trips
      </Link>
      <p className="eyebrow mt-8 mb-3">Draft trip</p>
      <h1 className="section-title mb-8 text-[#27382c]">{trip.title}</h1>
      <TripImageManager images={images ?? []} tripId={trip.id} />
    </main>
  );
}
