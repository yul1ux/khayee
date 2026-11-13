import Link from "next/link";
import type { TripLookupOption } from "@/lib/trips/public";

type TripSearchFormProps = {
  categories: TripLookupOption[];
  destinations: TripLookupOption[];
  query?: string;
  categoryId?: string;
  destinationId?: string;
  date?: string;
  minPrice?: number;
  maxPrice?: number;
  difficulty?: string;
  sort?: string;
};

const fieldClass =
  "mt-2 w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm text-[#29382d] focus-visible:outline-2 focus-visible:outline-[#68794d]";

export function TripSearchForm({
  categories,
  destinations,
  query = "",
  categoryId = "",
  destinationId = "",
  date = "",
  minPrice,
  maxPrice,
  difficulty = "",
  sort = "soonest",
}: TripSearchFormProps) {
  return (
    <form action="/trips" className="border border-[#e5e3db] bg-[#f7f6f1] p-4 sm:p-5" method="get" role="search">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold text-[#29382d]">
          Search trips
          <input className={fieldClass} maxLength={100} name="q" placeholder="Trip name or place" type="search" defaultValue={query} />
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Destination
          <select className={fieldClass} name="destinationId" defaultValue={destinationId}>
            <option value="">All destinations</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>{destination.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Trip style
          <select className={fieldClass} name="categoryId" defaultValue={categoryId}>
            <option value="">All trip styles</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Departure date
          <input className={fieldClass} name="date" type="date" defaultValue={date} />
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Minimum price (MMK)
          <input className={fieldClass} min={0} name="minPrice" inputMode="numeric" type="number" defaultValue={minPrice} />
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Maximum price (MMK)
          <input className={fieldClass} min={0} name="maxPrice" inputMode="numeric" type="number" defaultValue={maxPrice} />
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Difficulty
          <select className={fieldClass} name="difficulty" defaultValue={difficulty}>
            <option value="">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="moderate">Moderate</option>
            <option value="challenging">Challenging</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-[#29382d]">
          Sort by
          <select className={fieldClass} name="sort" defaultValue={sort}>
            <option value="soonest">Soonest departure</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
            <option value="newest">Recently added</option>
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d3c2a]" type="submit">
          Apply filters
        </button>
        <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/trips">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
