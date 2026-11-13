import { TripReviewForm } from "@/components/admin/moderation-forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminTripsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, organizer_profile_id, category_id, destination_id, title, summary, description, difficulty, duration_minutes, starts_at, ends_at, departure_location, capacity, price_mmk, safety_information, cancellation_policy, emergency_contact_information, included_services, excluded_services, required_equipment, status, submitted_at, rejection_reason")
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });
  if (tripsError) throw new Error("Could not load trips awaiting review.", { cause: tripsError });

  const tripRows = trips ?? [];
  const ids = tripRows.map(({ id }) => id);
  const categoryIds = [...new Set(tripRows.map(({ category_id }) => category_id))];
  const destinationIds = [...new Set(tripRows.map(({ destination_id }) => destination_id))];
  const [imagesResult, categoriesResult, destinationsResult, organizersResult] = ids.length > 0
    ? await Promise.all([
        supabase.from("trip_images").select("id, trip_id, storage_path, alt_text, sort_order").in("trip_id", ids).order("sort_order"),
        supabase.from("trip_categories").select("id, name").in("id", categoryIds),
        supabase.from("destinations").select("id, name, region").in("id", destinationIds),
        supabase.from("organizer_profiles").select("id, display_name").in("id", [...new Set(tripRows.map(({ organizer_profile_id }) => organizer_profile_id))]),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const lookupError = imagesResult.error ?? categoriesResult.error ?? destinationsResult.error ?? organizersResult.error;
  if (lookupError) throw new Error("Could not load trip review details.", { cause: lookupError });

  const categoryNames = new Map((categoriesResult.data ?? []).map(({ id, name }) => [id, name]));
  const destinationNames = new Map((destinationsResult.data ?? []).map(({ id, name, region }) => [id, `${name}, ${region}`]));
  const organizerNames = new Map((organizersResult.data ?? []).map(({ id, display_name }) => [id, display_name]));
  const imageUrls = await Promise.all((imagesResult.data ?? []).map(async (image) => {
    const { data, error } = await supabase.storage.from("trip-images").createSignedUrl(image.storage_path, 10 * 60);
    if (error || !data) {
      console.error("Could not create an administrator trip image URL", error);
      return { imageId: image.id, url: null };
    }
    return { imageId: image.id, url: data.signedUrl };
  }));
  const imageUrlById = new Map(imageUrls.map(({ imageId, url }) => [imageId, url]));

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <p className="eyebrow mb-3">Administrator review</p>
      <h1 className="section-title text-[#27382c]">Trips awaiting review</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">Only trips approved here become publicly discoverable.</p>
      {tripRows.length === 0 ? (
        <p className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">No trips are awaiting review.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {tripRows.map((trip) => {
            const tripImages = (imagesResult.data ?? []).filter(({ trip_id }) => trip_id === trip.id);
            return (
              <li className="border border-[#e5e3db] bg-[#fbfaf7] p-5 sm:p-6" key={trip.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-[#29382d]">{trip.title}</h2>
                    <p className="mt-1 text-sm text-[#73776e]">{organizerNames.get(trip.organizer_profile_id) ?? "Organizer"} · {categoryNames.get(trip.category_id) ?? "Category unavailable"} · {destinationNames.get(trip.destination_id) ?? "Destination unavailable"}</p>
                  </div>
                  <span className="text-sm font-semibold capitalize text-[#8a6c2d]">{trip.status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#51564e]">{trip.summary}</p>
                <div className="mt-4 grid gap-x-6 gap-y-2 text-sm text-[#51564e] sm:grid-cols-2 lg:grid-cols-3">
                  <p><strong>Departure:</strong> {new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short", timeZone: "Asia/Yangon" }).format(new Date(trip.starts_at))}</p>
                  <p><strong>Duration:</strong> {trip.duration_minutes} minutes</p>
                  <p><strong>Difficulty:</strong> {trip.difficulty}</p>
                  <p><strong>Capacity:</strong> {trip.capacity}</p>
                  <p><strong>Price:</strong> MMK {new Intl.NumberFormat("en-US").format(Number(trip.price_mmk))}</p>
                  <p><strong>Departure location:</strong> {trip.departure_location}</p>
                </div>
                <section className="mt-5">
                  <h3 className="font-semibold text-[#29382d]">Full description</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#51564e]">{trip.description}</p>
                </section>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <TextBlock title="Safety information" text={trip.safety_information} />
                  <TextBlock title="Cancellation policy" text={trip.cancellation_policy} />
                  <TextBlock title="Emergency contact information" text={trip.emergency_contact_information ?? "Not provided"} />
                  <TextBlock title="Included services" text={trip.included_services.join("\n") || "None listed"} />
                  <TextBlock title="Excluded services" text={trip.excluded_services.join("\n") || "None listed"} />
                  <TextBlock title="Required equipment" text={trip.required_equipment.join("\n") || "None listed"} />
                </div>
                {tripImages.length > 0 ? (
                  <section className="mt-6">
                    <h3 className="font-semibold text-[#29382d]">Submitted images</h3>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tripImages.map((image) => {
                          const imageUrl = imageUrlById.get(image.id);
                          return (
                            <li key={image.id}>
                            {imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img alt={image.alt_text} className="aspect-[1.4/1] w-full bg-[#e4e3d9] object-cover" src={imageUrl} />
                            ) : (
                              <p className="border border-dashed border-[#d9d8cf] p-4 text-sm text-[#73776e]">Image preview unavailable. Apply the admin image-access migration and retry.</p>
                            )}
                            <p className="mt-1 text-xs text-[#73776e]">{image.alt_text}</p>
                          </li>
                          );
                        })}
                    </ul>
                  </section>
                ) : <p className="mt-5 text-sm text-[#73776e]">No images submitted.</p>}
                <TripReviewForm tripId={trip.id} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-t border-[#e5e3db] pt-3">
      <h3 className="text-sm font-semibold text-[#29382d]">{title}</h3>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#51564e]">{text}</p>
    </section>
  );
}
