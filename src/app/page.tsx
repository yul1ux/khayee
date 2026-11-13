import { Suspense } from "react";
import { FeaturedTrips } from "@/components/marketplace/featured-trips";
import { HeroSection } from "@/components/marketplace/hero-section";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { OrganizerCta } from "@/components/marketplace/organizer-cta";
import { PopularDestinations } from "@/components/marketplace/popular-destinations";
import { TripCategories } from "@/components/marketplace/trip-categories";

export default function Home() {
  return (
    <>
      <main>
        <Suspense
          fallback={
            <section aria-busy="true" className="hero-photo min-h-[620px] animate-pulse bg-[#314638]" />
          }
        >
          <HeroSection />
        </Suspense>
        <Suspense
          fallback={
            <section aria-busy="true" className="bg-[#fbfaf7] py-20 sm:py-24">
              <div className="page-shell grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div className="aspect-[1.42/1] animate-pulse bg-[#f0efe9]" key={item} />
                ))}
              </div>
            </section>
          }
        >
          <FeaturedTrips />
        </Suspense>
        <TripCategories />
        <PopularDestinations />
        <Suspense fallback={null}>
          <OrganizerCta />
        </Suspense>
      </main>
      <MarketplaceFooter />
    </>
  );
}
