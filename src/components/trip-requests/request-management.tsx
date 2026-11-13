"use client";

import { useActionState } from "react";
import {
  cancelTripRequest,
  respondToTripRequest,
  type TripRequestActionState,
} from "@/app/account/requests/actions";
import type { OrganizerTripCapacity } from "@/lib/trip-requests/capacity";
import { ReportForm } from "@/components/reports/report-form";

type RequestStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type CustomerTripRequest = {
  id: string;
  tripId: string;
  tripTitle: string | null;
  startsAt: string | null;
  partySize: number;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
};

export function CustomerRequestList({ requests }: { requests: CustomerTripRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8">
        <p className="font-semibold text-[#29382d]">No trip requests yet</p>
        <p className="mt-2 text-sm text-[#73776e]">Explore published trips and request to join one.</p>
      </div>
    );
  }

  return (
    <ul className="mt-8 divide-y divide-[#e5e3db] border-y border-[#e5e3db]">
      {requests.map((request) => (
        <li className="py-6" key={request.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-[#29382d]">
                {request.tripTitle ?? "Trip no longer available"}
              </h2>
              <p className="mt-1 text-sm capitalize text-[#73776e]">
                {request.status} · {request.partySize} {request.partySize === 1 ? "participant" : "participants"}
                {request.startsAt ? ` · ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Yangon" }).format(new Date(request.startsAt))}` : ""}
              </p>
              {request.message ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#51564e]">{request.message}</p> : null}
            </div>
            {request.tripTitle ? (
              <a className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href={`/trips/${request.tripId}`}>
                View trip
              </a>
            ) : null}
          </div>
          {request.status === "pending" ? <CancelRequestForm requestId={request.id} /> : null}
        </li>
      ))}
    </ul>
  );
}

function CancelRequestForm({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    cancelTripRequest,
    {} satisfies TripRequestActionState,
  );

  return (
    <form action={formAction} className="mt-4">
      <input name="requestId" type="hidden" value={requestId} />
      {state.error ? <p className="mb-2 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="mb-2 text-sm text-[#31513b]" role="status">{state.message}</p> : null}
      <button className="text-sm font-semibold text-[#8a4034] underline underline-offset-4 disabled:opacity-60" disabled={isPending} type="submit">
        {isPending ? "Cancelling…" : "Cancel pending request"}
      </button>
    </form>
  );
}

export type OrganizerTripRequest = {
  id: string;
  customerId: string;
  tripTitle: string;
  partySize: number;
  message: string | null;
  status: RequestStatus;
  createdAt: string;
};

export function OrganizerRequestList({
  requests,
  tripCapacity,
}: {
  requests: OrganizerTripRequest[];
  tripCapacity: OrganizerTripCapacity[];
}) {
  if (tripCapacity.length === 0) {
    return (
      <div className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8">
        <p className="font-semibold text-[#29382d]">No trips to manage</p>
        <p className="mt-2 text-sm text-[#73776e]">Your trip request inbox will appear here when you create a trip.</p>
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="trip-capacity-heading" className="mt-8">
        <h2 className="text-lg font-semibold text-[#29382d]" id="trip-capacity-heading">Accepted participants and remaining places</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {tripCapacity.map((trip) => (
            <li className="border border-[#e5e3db] bg-[#fbfaf7] p-4" key={trip.tripId}>
              <h3 className="font-semibold text-[#29382d]">{trip.tripTitle}</h3>
              <p className="mt-1 text-sm capitalize text-[#73776e]">{trip.tripStatus.replaceAll("_", " ")}</p>
              <p className="mt-3 text-sm text-[#51564e]">
                {trip.acceptedParticipants} accepted · {trip.remainingCapacity} of {trip.capacity} places remaining
              </p>
            </li>
          ))}
        </ul>
      </section>
      {requests.length === 0 ? (
        <div className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8">
          <p className="font-semibold text-[#29382d]">No requests yet</p>
          <p className="mt-2 text-sm text-[#73776e]">Requests for your trips will appear here.</p>
        </div>
      ) : (
        <ul aria-label="Customer trip requests" className="mt-8 divide-y divide-[#e5e3db] border-y border-[#e5e3db]">
          {requests.map((request) => (
            <li className="py-6" key={request.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow mb-2">{request.tripTitle}</p>
                  <h2 className="font-semibold text-[#29382d]">
                    Customer · {request.partySize} {request.partySize === 1 ? "participant" : "participants"}
                  </h2>
                  <p className="mt-1 text-sm capitalize text-[#73776e]">
                    {request.status} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Yangon" }).format(new Date(request.createdAt))}
                  </p>
                  {request.message ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#51564e]">{request.message}</p> : null}
                  <p className="mt-2 text-xs text-[#73776e]">Customer profile details are private.</p>
                </div>
                {request.status === "pending" ? <RequestDecisionForm requestId={request.id} /> : null}
              </div>
              <ReportForm
                label="Report this customer"
                requestId={request.id}
                targetId={request.customerId}
                targetType="customer"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function RequestDecisionForm({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    respondToTripRequest,
    {} satisfies TripRequestActionState,
  );

  return (
    <div>
      {state.error ? <p className="mb-2 max-w-sm text-sm text-red-800" role="alert">{state.error}</p> : null}
      {state.message ? <p className="mb-2 text-sm text-[#31513b]" role="status">{state.message}</p> : null}
      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input name="requestId" type="hidden" value={requestId} />
          <input name="decision" type="hidden" value="accept" />
          <button className="bg-[#294a35] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
            {isPending ? "Saving…" : "Accept"}
          </button>
        </form>
        <form action={formAction}>
          <input name="requestId" type="hidden" value={requestId} />
          <input name="decision" type="hidden" value="reject" />
          <button className="border border-[#d9d8cf] px-4 py-2 text-sm font-semibold text-[#8a4034] disabled:opacity-60" disabled={isPending} type="submit">
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}
