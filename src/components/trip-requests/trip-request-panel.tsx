"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  submitTripRequest,
  type TripRequestActionState,
} from "@/app/account/requests/actions";

const initialState: TripRequestActionState = {};

type TripRequestPanelProps = {
  tripId: string;
  isSignedIn: boolean;
  isCustomer: boolean;
  isOwnTrip: boolean;
  activeRequest?: { id: string; status: "pending" | "accepted" };
  capacity: number;
};

export function TripRequestPanel({
  tripId,
  isSignedIn,
  isCustomer,
  isOwnTrip,
  activeRequest,
  capacity,
}: TripRequestPanelProps) {
  const [state, formAction, isPending] = useActionState(
    submitTripRequest,
    initialState,
  );
  const nextPath = `/trips/${tripId}`;

  return (
    <section aria-labelledby="request-trip-heading" className="border border-[#d9d8cf] bg-[#f7f6f1] p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-[#29382d]" id="request-trip-heading">
        Request to join
      </h2>
      {isOwnTrip ? (
        <p className="mt-3 text-sm leading-6 text-[#73776e]">
          You cannot request to join your own trip.
        </p>
      ) : activeRequest ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-[#51564e]">
            Your request is <span className="font-semibold capitalize">{activeRequest.status}</span>.
            You can track updates in your request list.
          </p>
          <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/account/requests">
            View my requests
          </Link>
        </div>
      ) : !isSignedIn ? (
        <p className="mt-3 text-sm leading-6 text-[#51564e]">
          <Link className="font-semibold text-[#35503a] underline underline-offset-4" href={`/login?next=${encodeURIComponent(nextPath)}`}>
            Sign in
          </Link>{" "}
          to request a place on this trip.
        </p>
      ) : !isCustomer ? (
        <p className="mt-3 text-sm leading-6 text-[#73776e]">
          A customer account is required to request this trip.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-[#73776e]">
            Request up to {capacity} places. The organizer will confirm availability.
          </p>
          <form action={formAction} className="mt-5 space-y-4">
            <input name="tripId" type="hidden" value={tripId} />
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="trip-request-party-size">
                Participants
              </label>
              <input
                className="w-full max-w-32 border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
                id="trip-request-party-size"
                max={capacity}
                min={1}
                name="partySize"
                required
                type="number"
                defaultValue={1}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#29382d]" htmlFor="trip-request-message">
                Message to the organizer <span className="font-normal text-[#73776e]">(optional)</span>
              </label>
              <textarea
                className="min-h-24 w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]"
                id="trip-request-message"
                maxLength={2000}
                name="message"
                rows={3}
              />
            </div>
            {state.error ? <p className="text-sm font-medium text-red-800" role="alert">{state.error}</p> : null}
            {state.message ? <p className="text-sm font-medium text-[#31513b]" role="status">{state.message}</p> : null}
            <button
              className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? "Sending request…" : "Request to join"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
