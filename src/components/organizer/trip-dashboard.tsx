import Link from "next/link";
import { canEditOrganizerTrip } from "@/lib/organizer/trip-validation";

export type OrganizerTripSummary = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
};

type TripDashboardProps = { trips: OrganizerTripSummary[] };

export function TripDashboard({ trips }: TripDashboardProps) {
  return (
    <section aria-labelledby="your-trips-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Your workspace</p>
          <h2 className="text-2xl font-semibold text-[#29382d]" id="your-trips-heading">Your trips</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="border border-[#294a35] px-4 py-2.5 text-sm font-semibold text-[#294a35]" href="/organizer/trips/requests">
            Trip requests
          </Link>
          <Link className="bg-[#294a35] px-4 py-2.5 text-sm font-semibold text-white" href="/organizer/trips/new">
            Create a trip
          </Link>
        </div>
      </div>
      {trips.length === 0 ? (
        <div className="mt-6 border border-dashed border-[#d9d8cf] px-5 py-9">
          <p className="font-semibold text-[#29382d]">No trips yet</p>
          <p className="mt-2 text-sm text-[#73776e]">Create your first trip draft to get started.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-[#e5e3db] border-y border-[#e5e3db]">
          {trips.map((trip) => {
            const editable = canEditOrganizerTrip(trip.status);
            return (
              <li className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center" key={trip.id}>
                <div>
                  <h3 className="font-semibold text-[#29382d]">{trip.title}</h3>
                  <p className="mt-1 text-xs capitalize text-[#73776e]">
                    {trip.status.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Yangon" }).format(new Date(trip.starts_at))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {editable ? <Link className="font-semibold text-[#35503a] underline underline-offset-4" href={`/organizer/trips/${trip.id}/edit`}>Edit trip</Link> : null}
                  {editable ? <Link className="font-semibold text-[#35503a] underline underline-offset-4" href={`/organizer/trips/${trip.id}/images`}>Manage images</Link> : null}
                  {trip.status === "published" ? <Link className="font-semibold text-[#35503a] underline underline-offset-4" href={`/trips/${trip.id}`}>View published trip</Link> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
