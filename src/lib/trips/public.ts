import type { SupabaseClient } from "@supabase/supabase-js";
import {
  myanmarDateBounds,
  type TripSearchFilters,
} from "@/lib/trips/search";

export type TripLookupOption = {
  id: string;
  slug: string;
  name: string;
};

export type PublicTripCardData = {
  id: string;
  title: string;
  summary: string;
  destination: string;
  category: string;
  difficulty: string;
  duration: string;
  priceMmk: string;
  organizer: string;
  imageUrl: string | null;
  imageDescription: string;
  startsAt: string;
};

export async function getTripSearchOptions(supabase: SupabaseClient) {
  const [categoriesResult, destinationsResult] = await Promise.all([
    supabase
      .from("trip_categories")
      .select("id, slug, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("destinations")
      .select("id, slug, name")
      .eq("is_active", true)
      .order("name"),
  ]);
  if (categoriesResult.error || destinationsResult.error) {
    throw new Error("Could not load trip search options.", {
      cause: categoriesResult.error ?? destinationsResult.error,
    });
  }
  return {
    categories: (categoriesResult.data ?? []) as TripLookupOption[],
    destinations: (destinationsResult.data ?? []) as TripLookupOption[],
  };
}

export async function getPublishedTripCards(
  supabase: SupabaseClient,
  filters: TripSearchFilters,
  options: { categories: TripLookupOption[]; destinations: TripLookupOption[] },
  pageSize: number,
) {
  const categoryId =
    filters.categoryId ||
    options.categories.find((category) => category.slug === filters.categoryName)?.id;
  const destinationId =
    filters.destinationId ||
    options.destinations.find((destination) => destination.slug === filters.destinationName)?.id;
  if ((filters.categoryName && !categoryId) || (filters.destinationName && !destinationId)) {
    return { trips: [], count: 0 };
  }

  const from = (filters.page - 1) * pageSize;
  const now = new Date().toISOString();
  let query = supabase
    .from("trips")
    .select(
      "id, title, summary, category_id, destination_id, difficulty, duration_minutes, starts_at, price_mmk, organizer_profile_id, created_at",
      { count: "exact" },
    )
    .gt("starts_at", now);

  if (filters.query) {
    const safeQuery = filters.query.replace(/[^\p{L}\p{N}\s'-]/gu, "").trim();
    if (safeQuery) {
      const pattern = `%${safeQuery}%`;
      query = query.or(
        `title.ilike.${pattern},summary.ilike.${pattern},departure_location.ilike.${pattern}`,
      );
    }
  }
  if (categoryId) query = query.eq("category_id", categoryId);
  if (destinationId) query = query.eq("destination_id", destinationId);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.minPrice !== undefined) query = query.gte("price_mmk", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("price_mmk", filters.maxPrice);
  if (filters.date) {
    const bounds = myanmarDateBounds(filters.date);
    if (!bounds) return { trips: [], count: 0 };
    query = query.gte("starts_at", bounds.from).lt("starts_at", bounds.to);
  }

  if (filters.sort === "price_low") query = query.order("price_mmk", { ascending: true });
  else if (filters.sort === "price_high") query = query.order("price_mmk", { ascending: false });
  else if (filters.sort === "newest") query = query.order("created_at", { ascending: false });
  else query = query.order("starts_at", { ascending: true });
  query = query.order("id", { ascending: true });

  const { data: tripRows, error: tripsError, count } = await query.range(from, from + pageSize - 1);
  if (tripsError) {
    throw new Error("Could not load published trips.", { cause: tripsError });
  }
  const trips = tripRows ?? [];
  const ids = [...new Set(trips.map((trip) => trip.id))];
  const categoryIds = [...new Set(trips.map((trip) => trip.category_id))];
  const destinationIds = [...new Set(trips.map((trip) => trip.destination_id))];
  const organizerIds = [...new Set(trips.map((trip) => trip.organizer_profile_id))];
  if (ids.length === 0) return { trips: [], count: count ?? 0 };

  const [imagesResult, categoriesResult, destinationsResult, organizersResult] = await Promise.all([
    supabase
      .from("trip_images")
      .select("trip_id, storage_path, alt_text, sort_order")
      .in("trip_id", ids)
      .order("sort_order", { ascending: true }),
    supabase.from("trip_categories").select("id, name").in("id", categoryIds),
    supabase.from("destinations").select("id, name, region").in("id", destinationIds),
    supabase.from("organizer_profiles").select("id, display_name").in("id", organizerIds),
  ]);
  const lookupError =
    imagesResult.error ??
    categoriesResult.error ??
    destinationsResult.error ??
    organizersResult.error;
  if (lookupError) {
    throw new Error("Could not load published trip details.", { cause: lookupError });
  }

  const imageByTrip = new Map<string, { storagePath: string; altText: string }>();
  for (const image of imagesResult.data ?? []) {
    if (!imageByTrip.has(image.trip_id)) {
      imageByTrip.set(image.trip_id, {
        storagePath: image.storage_path,
        altText: image.alt_text,
      });
    }
  }
  const categoryById = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
  const destinationById = new Map(
    (destinationsResult.data ?? []).map((destination) => [
      destination.id,
      `${destination.name}, ${destination.region}`,
    ]),
  );
  const organizerById = new Map(
    (organizersResult.data ?? []).map((organizer) => [organizer.id, organizer.display_name]),
  );

  const cards = await Promise.all(
    trips.map(async (trip): Promise<PublicTripCardData> => {
      const image = imageByTrip.get(trip.id);
      let imageUrl: string | null = null;
      if (image) {
        const { data, error } = await supabase.storage
          .from("trip-images")
          .createSignedUrl(image.storagePath, 10 * 60);
        if (error || !data) {
          throw new Error("Could not create a temporary trip image URL.", { cause: error });
        }
        imageUrl = data.signedUrl;
      }

      return {
        id: trip.id,
        title: trip.title,
        summary: trip.summary,
        destination: destinationById.get(trip.destination_id) ?? "Myanmar",
        category: categoryById.get(trip.category_id) ?? "Outdoor",
        difficulty: trip.difficulty,
        duration: formatDuration(trip.duration_minutes),
        priceMmk: String(trip.price_mmk),
        organizer: organizerById.get(trip.organizer_profile_id) ?? "Local organizer",
        imageUrl,
        imageDescription: image?.altText ?? trip.title,
        startsAt: trip.starts_at,
      };
    }),
  );
  return { trips: cards, count: count ?? 0 };
}

export async function getPublishedTripById(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, organizer_profile_id, title, summary, description, difficulty, duration_minutes, starts_at, ends_at, departure_location, capacity, price_mmk, safety_information, cancellation_policy, included_services, excluded_services, required_equipment, category_id, destination_id, emergency_contact_information",
    )
    .eq("id", tripId)
    .maybeSingle();
  if (error) {
    throw new Error("Could not load the published trip.", { cause: error });
  }
  return data;
}

export async function getPublicTripMetadata(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase
    .from("trips")
    .select("title, summary")
    .eq("id", tripId)
    .maybeSingle();
  if (error) {
    throw new Error("Could not load trip metadata.", { cause: error });
  }
  return data;
}

export function formatMmk(amount: string | number) {
  return `MMK ${new Intl.NumberFormat("en-US").format(BigInt(amount))}`;
}

function formatDuration(minutes: number) {
  if (minutes >= 1440) {
    const days = Math.ceil(minutes / 1440);
    return `${days} ${days === 1 ? "day" : "days"}`;
  }
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  return `${minutes} min`;
}
