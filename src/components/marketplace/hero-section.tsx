import { Icon } from "@/components/marketplace/icon";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { getTripSearchOptions } from "@/lib/trips/public";

export async function HeroSection() {
  const options = await getTripSearchOptions(createSupabasePublicClient());

  return (
    <section className="hero-photo relative isolate text-white">
      <div className="page-shell flex min-h-[620px] flex-col justify-center pb-10 pt-16 sm:min-h-[650px] sm:pb-20 sm:pt-20">
        <div className="max-w-[740px]">
          <p className="mb-5 flex items-center gap-3 text-[0.7rem] font-semibold tracking-[0.19em] text-[#e2d9bb] uppercase">
            <span className="h-px w-8 bg-[#d1c28d]" />
            Find your way out there
          </p>
          <h1 className="max-w-[720px] font-[family-name:var(--font-geist-sans)] text-[clamp(3.2rem,7.6vw,6.4rem)] leading-[0.98] font-medium tracking-[-0.065em] text-white">
            The wild side of Myanmar is closer than you think.
          </h1>
          <p className="mt-6 max-w-[500px] text-base leading-7 text-white/80 sm:text-lg sm:leading-8">
            Find your people, leave the usual behind, and explore the trails,
            forests, and highlands just beyond Mandalay.
          </p>
        </div>

        <div
          className="mt-10 max-w-[980px] bg-[#fbfaf7] p-3 text-[#202821] shadow-[0_18px_50px_rgba(12,26,17,0.22)] sm:mt-12 sm:p-4"
        >
          <form action="/trips" className="grid gap-3 sm:grid-cols-[1.05fr_1.05fr_0.9fr_auto] sm:items-end sm:gap-0" method="get" role="search">
            <label className="flex min-w-0 flex-col gap-2 border-b border-[#e8e6de] px-3 py-2 sm:border-r sm:border-b-0 sm:py-1 sm:pr-5">
              <span className="text-[0.64rem] font-bold tracking-[0.14em] text-[#777a6d] uppercase">
                Destination
              </span>
              <span className="flex items-center gap-2.5">
                <Icon className="size-[18px] shrink-0 text-[#6b7953]" name="pin" />
                <select
                  aria-label="Choose a destination"
                  className="w-full appearance-none bg-transparent text-sm font-medium text-[#29372d] outline-none"
                  defaultValue=""
                  name="destinationId"
                >
                  <option value="">All destinations</option>
                  {options.destinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>{destination.name}</option>
                  ))}
                </select>
              </span>
            </label>

            <label className="flex min-w-0 flex-col gap-2 border-b border-[#e8e6de] px-3 py-2 sm:border-r sm:border-b-0 sm:px-5 sm:py-1">
              <span className="text-[0.64rem] font-bold tracking-[0.14em] text-[#777a6d] uppercase">
                Trip style
              </span>
              <span className="flex items-center gap-2.5">
                <Icon className="size-[18px] shrink-0 text-[#6b7953]" name="compass" />
                <select
                  aria-label="Choose a trip style"
                  className="w-full appearance-none bg-transparent text-sm font-medium text-[#29372d] outline-none"
                  defaultValue=""
                  name="categoryId"
                >
                  <option value="">Any trip style</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </span>
            </label>

            <label className="flex min-w-0 flex-col gap-2 px-3 py-2 sm:px-5 sm:py-1">
              <span className="text-[0.64rem] font-bold tracking-[0.14em] text-[#777a6d] uppercase">
                When
              </span>
              <span className="flex items-center gap-2.5">
                <Icon className="size-[18px] shrink-0 text-[#6b7953]" name="calendar" />
                <input
                  aria-label="Choose a trip date"
                  className="w-full min-w-0 bg-transparent text-sm font-medium text-[#29372d] outline-none"
                  name="date"
                  type="date"
                />
              </span>
            </label>

            <button className="focus-ring inline-flex h-12 items-center justify-center gap-2 bg-[#294a35] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1d3c2a] sm:ml-2" type="submit">
              Explore trips
              <Icon className="size-4" name="arrowRight" />
            </button>
          </form>
          <p className="px-3 pt-2 text-[0.68rem] text-[#85867e]">
            Browse upcoming trips published after administrator review.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-white/75">
          <Icon className="size-4 text-[#d9c98f]" name="check" />
          Small groups. Local organizers. Trips reviewed before they go live.
        </div>
      </div>
    </section>
  );
}
