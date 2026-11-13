import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/marketplace/icon";
import { formatMmk, type PublicTripCardData } from "@/lib/trips/public";

type TripCardProps = {
  trip: PublicTripCardData;
};

export function TripCard({ trip }: TripCardProps) {
  return (
    <article className="group min-w-0">
      <Link aria-label={`View ${trip.title}`} className="block" href={`/trips/${trip.id}`}>
        <div className="image-card relative aspect-[1.42/1] overflow-hidden bg-[#e4e3d9]">
          {trip.imageUrl ? (
            <Image
              alt={trip.imageDescription}
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              fill
              src={trip.imageUrl}
              unoptimized
            />
          ) : (
            <div aria-label="No trip photo available" className="h-full w-full bg-[#dfe2d7]" role="img" />
          )}
          <span className="absolute top-3 left-3 bg-[#fbfaf7] px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide text-[#354735]">
            {trip.category}
          </span>
          <span className="absolute right-3 bottom-3 bg-[#203b2b]/90 px-2.5 py-1 text-[0.65rem] font-medium text-white capitalize">
            {trip.difficulty}
          </span>
        </div>
        <div className="pt-4">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[#777a6d]">
            <Icon className="size-3.5 text-[#6b7953]" name="pin" />
            {trip.destination}
            <span className="mx-0.5 text-[#b3b1a6]">·</span>
            {trip.duration}
          </p>
          <h3 className="mt-2 min-h-[48px] font-[family-name:var(--font-geist-sans)] text-[1.15rem] leading-6 font-semibold tracking-[-0.03em] text-[#28352b] transition-colors group-hover:text-[#5b7147]">
            {trip.title}
          </h3>
          <p className="mt-2 text-xs text-[#73776e]">
            By <span className="font-medium text-[#4c554b]">{trip.organizer}</span>
          </p>
          <div className="mt-4 flex items-baseline justify-between border-t border-[#e5e3db] pt-3">
            <span className="text-[0.68rem] text-[#777a6d]">From</span>
            <p className="text-sm font-bold tracking-[-0.02em] text-[#294a35]">
              {formatMmk(trip.priceMmk)}
              <span className="ml-1 text-[0.65rem] font-normal text-[#777a6d]">
                / person
              </span>
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
