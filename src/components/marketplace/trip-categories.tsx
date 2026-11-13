import Link from "next/link";
import { Icon } from "@/components/marketplace/icon";
import type { IconName } from "@/components/marketplace/icon";

const categories: {
  name: string;
  description: string;
  icon: IconName;
  imageUrl: string;
  imageDescription: string;
}[] = [
  {
    name: "Trekking",
    description: "Go further, one trail at a time.",
    icon: "mountain",
    imageUrl:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=760&q=82",
    imageDescription: "Hikers setting out on a mountain trail",
  },
  {
    name: "Hiking",
    description: "A fresh-air fix, near or far.",
    icon: "compass",
    imageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=760&q=82",
    imageDescription: "A hiker looking out over a mountain range",
  },
  {
    name: "Camping",
    description: "Stay awhile under open skies.",
    icon: "check",
    imageUrl:
      "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=760&q=82",
    imageDescription: "A forest campsite under the trees",
  },
  {
    name: "Adventure",
    description: "Take the scenic route, and then some.",
    icon: "arrowRight",
    imageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=760&q=82",
    imageDescription: "A green valley beyond a mountain trail",
  },
];

export function TripCategories() {
  return (
    <section className="bg-[#efeee7] py-20 sm:py-24" id="categories">
      <div className="page-shell">
        <div className="mb-9 max-w-[540px]">
          <p className="eyebrow mb-3">Pick your pace</p>
          <h2 className="section-title text-[#27382c]">A little more outside.</h2>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {categories.map((category) => (
            <Link
              className="image-card focus-ring group relative isolate flex min-h-[240px] flex-col justify-end overflow-hidden bg-[#52674d] p-5 text-white sm:min-h-[290px] sm:p-6"
              href={`/trips?categoryName=${encodeURIComponent(category.name.toLowerCase())}`}
              key={category.name}
            >
              <div
                aria-label={category.imageDescription}
                className="category-photo absolute inset-0 -z-10"
                role="img"
                style={{ backgroundImage: `url("${category.imageUrl}")` }}
              />
              <span className="relative mb-4 flex size-9 items-center justify-center border border-white/45 bg-white/10">
                <Icon className="size-[19px]" name={category.icon} />
              </span>
              <h3 className="relative font-[family-name:var(--font-geist-sans)] text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                {category.name}
              </h3>
              <p className="relative mt-1 text-xs leading-5 text-white/80 sm:text-sm">
                {category.description}
              </p>
              <span className="absolute top-5 right-5 flex size-8 items-center justify-center border border-white/40 text-white transition-colors group-hover:bg-white group-hover:text-[#27382c]">
                <Icon className="size-4" name="arrowRight" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
