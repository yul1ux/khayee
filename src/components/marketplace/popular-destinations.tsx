import Link from "next/link";
import { Icon } from "@/components/marketplace/icon";

const destinations = [
  {
    name: "Pyin Oo Lwin",
    region: "Mandalay Region",
    description: "Pine-scented trails and cool highland air.",
    imageUrl:
      "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=82",
    imageDescription: "A quiet path through a deep green pine forest",
  },
  {
    name: "Mount Popa",
    region: "Mandalay Region",
    description: "Volcanic slopes, wide views, and early starts.",
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=82",
    imageDescription: "A dramatic mountain summit above the clouds",
  },
  {
    name: "Hsipaw",
    region: "Northern Shan State",
    description: "Ridge walks and river valleys worth the journey.",
    imageUrl:
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1000&q=82",
    imageDescription: "A sweeping forested valley with distant hills",
  },
];

export function PopularDestinations() {
  return (
    <section className="bg-[#fbfaf7] py-20 sm:py-24" id="destinations">
      <div className="page-shell">
        <div className="mb-9 flex flex-col justify-between gap-4 sm:mb-11 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow mb-3">Somewhere worth going</p>
            <h2 className="section-title text-[#27382c]">Out there, close to home.</h2>
          </div>
          <p className="max-w-[370px] text-sm leading-6 text-[#73776e]">
            Start with the highlands and hidden trails around Mandalay. The
            best stories are often closer than you think.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {destinations.map((destination) => (
            <Link
              className="image-card focus-ring group relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden bg-[#52674d] p-6 text-white sm:min-h-[360px] sm:p-7"
              href={`/trips?destinationName=${encodeURIComponent(destination.name.toLowerCase().replaceAll(" ", "-"))}`}
              key={destination.name}
            >
              <div
                aria-label={destination.imageDescription}
                className="destination-photo absolute inset-0 -z-10"
                role="img"
                style={{ backgroundImage: `url("${destination.imageUrl}")` }}
              />
              <p className="relative mb-2 flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.12em] text-white/80 uppercase">
                <Icon className="size-3.5" name="pin" />
                {destination.region}
              </p>
              <h3 className="relative font-[family-name:var(--font-geist-sans)] text-2xl font-semibold tracking-[-0.04em] sm:text-[1.8rem]">
                {destination.name}
              </h3>
              <p className="relative mt-2 max-w-[260px] text-sm leading-5 text-white/80">
                {destination.description}
              </p>
              <span className="absolute top-5 right-5 flex size-9 items-center justify-center border border-white/50 text-white transition-colors group-hover:bg-white group-hover:text-[#27382c]">
                <Icon className="size-[18px]" name="arrowRight" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
