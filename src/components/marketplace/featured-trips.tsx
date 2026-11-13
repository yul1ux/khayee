import Link from "next/link";
import { Icon } from "@/components/marketplace/icon";
import { TripCard } from "@/components/marketplace/trip-card";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getPublishedTripCards, getTripSearchOptions } from "@/lib/trips/public";

export async function FeaturedTrips() {
  const supabase = createSupabasePublicClient();
  const options = await getTripSearchOptions(supabase);
  const { trips } = await getPublishedTripCards(
    supabase,
    {
      query: "",
      categoryId: "",
      categoryName: "",
      destinationId: "",
      destinationName: "",
      date: "",
      minPrice: undefined,
      maxPrice: undefined,
      difficulty: "",
      sort: "soonest",
      page: 1,
    },
    options,
    4,
  );

  return (
    <section className="bg-[#fbfaf7] py-20 sm:py-24" id="trips">
      <div className="page-shell">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:mb-12 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow mb-3">Made for the long way round</p>
            <h2 className="section-title max-w-[540px] text-[#27382c]">
              Find your next way out.
            </h2>
            <p className="mt-4 max-w-[460px] text-sm leading-6 text-[#73776e]">
              Good days outside, planned by people who know the way.
            </p>
          </div>
          <Link
            className="focus-ring inline-flex w-fit items-center gap-2 border-b border-[#9da68d] pb-1 text-sm font-semibold text-[#35503a] transition-colors hover:border-[#294a35] hover:text-[#1d3c2a]"
            href="#categories"
          >
            Browse by trip style
            <Icon className="size-4" name="arrowRight" />
          </Link>
        </div>

        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
        {trips.length === 0 ? (
          <p className="border border-dashed border-[#d9d8cf] px-5 py-8 text-sm leading-6 text-[#73776e]">
            New trips are being reviewed. Check back soon or explore all available trips.
          </p>
        ) : null}
        <Link className="mt-8 inline-flex text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/trips">
          Explore all published trips
        </Link>
      </div>
    </section>
  );
}
