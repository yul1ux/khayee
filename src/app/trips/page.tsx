import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { TripCard } from "@/components/marketplace/trip-card";
import { TripSearchForm } from "@/components/marketplace/trip-search-form";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getPublishedTripCards, getTripSearchOptions } from "@/lib/trips/public";
import { parseTripSearchParams, type TripSearchParams } from "@/lib/trips/search";

export const metadata: Metadata = {
  title: "Explore outdoor trips in Myanmar | Khayee",
  description: "Search upcoming published hiking, trekking, camping, and adventure trips in Myanmar.",
};

type TripsPageProps = {
  searchParams: Promise<TripSearchParams>;
};

export default function TripsPage({ searchParams }: TripsPageProps) {
  return (
    <>
      <main className="page-shell min-h-[65vh] py-12 sm:py-16">
        <header className="mb-9">
          <p className="eyebrow mb-3">Find your next way out</p>
          <h1 className="section-title text-[#27382c]">Explore published trips</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
            Browse upcoming trips led by local organizers. Every trip shown here has been reviewed and published.
          </p>
        </header>
        <Suspense fallback={<TripResultsFallback />}>
          <TripResults searchParams={searchParams} />
        </Suspense>
      </main>
      <MarketplaceFooter />
    </>
  );
}

async function TripResults({ searchParams }: TripsPageProps) {
  const params = await searchParams;
  const parsed = parseTripSearchParams(params);
  const supabase = createSupabasePublicClient();
  const options = await getTripSearchOptions(supabase);
  const selectedCategoryId =
    parsed.filters.categoryId ||
    options.categories.find((category) => category.slug === parsed.filters.categoryName)?.id ||
    "";
  const selectedDestinationId =
    parsed.filters.destinationId ||
    options.destinations.find((destination) => destination.slug === parsed.filters.destinationName)?.id ||
    "";

  if (parsed.error) {
    return (
      <>
        <TripSearchForm
          categories={options.categories}
          destinations={options.destinations}
          categoryId={selectedCategoryId}
          destinationId={selectedDestinationId}
          query={parsed.filters.query}
          date={parsed.filters.date}
          minPrice={parsed.filters.minPrice}
          maxPrice={parsed.filters.maxPrice}
          difficulty={parsed.filters.difficulty}
          sort={parsed.filters.sort}
        />
        <p className="mt-5 text-sm font-medium text-red-800" role="alert">{parsed.error}</p>
      </>
    );
  }

  const { trips, count } = await getPublishedTripCards(
    supabase,
    parsed.filters,
    options,
    12,
  );
  const pageCount = Math.ceil(count / 12);

  return (
    <>
      <TripSearchForm
        categories={options.categories}
        destinations={options.destinations}
        categoryId={selectedCategoryId}
        destinationId={selectedDestinationId}
        query={parsed.filters.query}
        date={parsed.filters.date}
        minPrice={parsed.filters.minPrice}
        maxPrice={parsed.filters.maxPrice}
        difficulty={parsed.filters.difficulty}
        sort={parsed.filters.sort}
      />
      <div aria-live="polite" className="mt-8">
        <p className="text-sm text-[#73776e]">
          {count} {count === 1 ? "trip" : "trips"} found
        </p>
        {trips.length > 0 ? (
          <div className="mt-5 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => <TripCard key={trip.id} trip={trip} />)}
          </div>
        ) : (
          <div className="mt-5 border border-dashed border-[#d9d8cf] px-5 py-10">
            <h2 className="font-semibold text-[#29382d]">No trips match those filters</h2>
            <p className="mt-2 text-sm leading-6 text-[#73776e]">
              Try a different destination, date, or price range. New trips appear after administrator review.
            </p>
          </div>
        )}
      </div>
      {pageCount > 1 ? (
        <nav aria-label="Trip result pages" className="mt-10 flex items-center justify-between border-t border-[#e5e3db] pt-5">
          {parsed.filters.page > 1 ? (
            <Link className="font-semibold text-[#35503a] underline underline-offset-4" href={pageHref(params, parsed.filters.page - 1)}>
              Previous
            </Link>
          ) : <span />}
          <span className="text-sm text-[#73776e]">Page {parsed.filters.page} of {pageCount}</span>
          {parsed.filters.page < pageCount ? (
            <Link className="font-semibold text-[#35503a] underline underline-offset-4" href={pageHref(params, parsed.filters.page + 1)}>
              Next
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </>
  );
}

function pageHref(params: TripSearchParams, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || typeof value !== "string" || value === "") continue;
    query.set(key, value);
  }
  query.set("page", String(page));
  return `/trips?${query.toString()}`;
}

function TripResultsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading trips" className="space-y-6">
      <div className="h-52 animate-pulse bg-[#f0efe9]" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => <div className="aspect-[1.42/1] animate-pulse bg-[#f0efe9]" key={item} />)}
      </div>
    </div>
  );
}
