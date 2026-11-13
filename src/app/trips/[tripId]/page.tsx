import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { TripRequestPanel } from "@/components/trip-requests/trip-request-panel";
import { ReportForm } from "@/components/reports/report-form";
import { TripSafetyDetails } from "@/components/trips/trip-safety-details";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMmk, getPublicTripMetadata, getPublishedTripById } from "@/lib/trips/public";

export const instant = false;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublishedTripPageProps = {
  params: Promise<{ tripId: string }>;
};

export async function generateMetadata({
  params,
}: PublishedTripPageProps): Promise<Metadata> {
  const { tripId } = await params;
  if (!UUID_PATTERN.test(tripId)) {
    return { title: "Trip not found | Khayee" };
  }

  const trip = await getPublicTripMetadata(createSupabasePublicClient(), tripId);
  if (!trip) {
    return { title: "Trip not found | Khayee" };
  }

  return {
    title: `${trip.title} | Khayee`,
    description: trip.summary,
  };
}

export default async function PublishedTripPage({
  params,
}: PublishedTripPageProps) {
  const { tripId } = await params;
  if (!UUID_PATTERN.test(tripId)) {
    notFound();
  }

  const publicSupabase = createSupabasePublicClient();
  const trip = await getPublishedTripById(publicSupabase, tripId);
  if (!trip) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && !isUnauthenticatedSessionError(userError)) {
    throw new Error("Could not verify the current session.", { cause: userError });
  }
  let isCustomer = false;
  let isOwnTrip = false;
  let activeRequest: { id: string; status: "pending" | "accepted" } | undefined;
  if (userData.user) {
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    if (rolesError) {
      throw new Error("Could not load account permissions.", { cause: rolesError });
    }
    const roleNames = (roles ?? []).map(({ role }) => role);
    isCustomer = roleNames.includes("customer");
    if (isCustomer) {
      const { data: request, error: requestError } = await supabase
        .from("trip_requests")
        .select("id, status")
        .eq("trip_id", trip.id)
        .eq("customer_id", userData.user.id)
        .in("status", ["pending", "accepted"])
        .maybeSingle();
      if (requestError) {
        throw new Error("Could not load your existing trip request.", { cause: requestError });
      }
      if (request) {
        activeRequest = { id: request.id, status: request.status };
      }
    }
    if (roleNames.includes("organizer") && !roleNames.includes("admin")) {
      const { data: details, error: detailsError } = await supabase
        .from("organizer_verification_details")
        .select("organizer_profile_id")
        .maybeSingle();
      if (detailsError) {
        throw new Error("Could not verify trip ownership.", { cause: detailsError });
      }
      isOwnTrip = details?.organizer_profile_id === trip.organizer_profile_id;
    }
  }

  const [categoryResult, destinationResult, imagesResult] = await Promise.all([
    publicSupabase
      .from("trip_categories")
      .select("name")
      .eq("id", trip.category_id)
      .maybeSingle(),
    publicSupabase
      .from("destinations")
      .select("name, region")
      .eq("id", trip.destination_id)
      .maybeSingle(),
    publicSupabase
      .from("trip_images")
      .select("id, storage_path, alt_text, sort_order")
      .eq("trip_id", trip.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (categoryResult.error || destinationResult.error || imagesResult.error) {
    throw new Error("Could not load trip details or images.", {
      cause:
        categoryResult.error ??
        destinationResult.error ??
        imagesResult.error,
    });
  }

  const images = await Promise.all(
    (imagesResult.data ?? []).map(async (image) => {
      const { data, error } = await publicSupabase.storage
        .from("trip-images")
        .createSignedUrl(image.storage_path, 10 * 60);

      if (error || !data) {
        throw new Error("Could not create a temporary trip image URL.", {
          cause: error,
        });
      }

      return { id: image.id, altText: image.alt_text, url: data.signedUrl };
    }),
  );

  const startDate = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "Asia/Yangon",
  }).format(new Date(trip.starts_at));

  return (
    <>
      <main className="page-shell min-h-[65vh] py-12 sm:py-16">
        <p className="eyebrow mb-3">
          {categoryResult.data?.name ?? "Myanmar adventure"}
        </p>
        <h1 className="section-title max-w-4xl text-[#27382c]">
          {trip.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#73776e]">
          {trip.summary}
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#51564e]">
          <span>
            {destinationResult.data
              ? `${destinationResult.data.name}, ${destinationResult.data.region}`
              : trip.departure_location}
          </span>
          <span>{startDate}</span>
          <span>{Math.ceil(trip.duration_minutes / 1440)} days</span>
          <span className="capitalize">{trip.difficulty}</span>
          <span className="font-semibold text-[#294a35]">
            {formatMmk(trip.price_mmk)}
          </span>
        </div>

        {images.length > 0 ? (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((image) => (
              <li className="overflow-hidden bg-[#e4e3d9]" key={image.id}>
                {/* Signed URLs are short-lived access to this private bucket. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={image.altText}
                  className="aspect-[1.4/1] w-full object-cover"
                  src={image.url}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-12 grid gap-10 border-t border-[#e5e3db] pt-8 md:grid-cols-[1.5fr_1fr]">
          <section>
            <h2 className="text-xl font-semibold text-[#29382d]">
              About this trip
            </h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#51564e]">
              {trip.description}
            </p>
          </section>
          <aside className="space-y-7">
            <TripRequestPanel
              activeRequest={activeRequest}
              capacity={trip.capacity}
              isCustomer={isCustomer}
              isOwnTrip={isOwnTrip}
              isSignedIn={Boolean(userData.user)}
              tripId={trip.id}
            />
            <TripSafetyDetails
              cancellationPolicy={trip.cancellation_policy}
              difficulty={trip.difficulty}
              durationMinutes={trip.duration_minutes}
              emergencyContactInformation={trip.emergency_contact_information}
              excludedServices={trip.excluded_services}
              includedServices={trip.included_services}
              requiredEquipment={trip.required_equipment}
              safetyInformation={trip.safety_information}
            />
            {isCustomer && !isOwnTrip ? (
              <section className="border-t border-[#e5e3db] pt-4">
                <h2 className="text-sm font-semibold text-[#29382d]">Safety and conduct</h2>
                <ReportForm label="Report this trip" targetId={trip.id} targetType="trip" />
                <ReportForm label="Report this organizer" targetId={trip.organizer_profile_id} targetType="organizer" />
              </section>
            ) : null}
          </aside>
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}
