import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";

export default function TripsLoading() {
  return (
    <>
      <main aria-busy="true" className="page-shell min-h-[65vh] py-12 sm:py-16">
        <div className="h-10 w-72 animate-pulse bg-[#f0efe9]" />
        <div className="mt-8 h-52 animate-pulse bg-[#f0efe9]" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <div className="aspect-[1.42/1] animate-pulse bg-[#f0efe9]" key={item} />)}
        </div>
      </main>
      <MarketplaceFooter />
    </>
  );
}
