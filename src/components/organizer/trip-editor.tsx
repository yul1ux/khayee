"use client";

import { useActionState } from "react";
import {
  createTrip,
  submitTripForReview,
  updateTrip,
  type TripFormState,
} from "@/app/organizer/trips/actions";

type Choice = { id: string; name: string };
export type TripValues = {
  id: string;
  category_id: string;
  destination_id: string;
  title: string;
  summary: string;
  description: string;
  difficulty: "easy" | "moderate" | "challenging";
  duration_minutes: number;
  starts_at: string;
  ends_at: string;
  departure_location: string;
  capacity: number;
  price_mmk: string | number;
  safety_information: string;
  cancellation_policy: string;
  emergency_contact_information: string | null;
  included_services: string[];
  excluded_services: string[];
  required_equipment: string[];
  status: string;
};

type TripEditorProps = {
  categories: Choice[];
  destinations: Choice[];
  trip?: TripValues;
  created?: boolean;
};

const initialState: TripFormState = {};
const inputClass = "w-full border border-[#d9d8cf] bg-white px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[#68794d]";

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required = true,
  maxLength,
  min,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-[#29382d]">
      {label}
      <input className={inputClass} defaultValue={defaultValue} maxLength={maxLength} min={min} name={name} required={required} type={type} />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  required = true,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-[#29382d]">
      {label}
      <textarea className={`${inputClass} min-h-28`} defaultValue={defaultValue} maxLength={maxLength} name={name} required={required} rows={4} />
    </label>
  );
}

export function TripEditor({ categories, destinations, trip, created }: TripEditorProps) {
  const action = trip ? updateTrip : createTrip;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [reviewState, reviewAction, isReviewPending] = useActionState(submitTripForReview, initialState);
  const hasReferences = categories.length > 0 && destinations.length > 0;

  return (
    <div className="space-y-8">
      {created ? <p className="border border-[#cbd6c0] bg-[#f0f3eb] p-3 text-sm text-[#31513b]" role="status">Trip draft created. Add images before submitting it for review.</p> : null}
      {!hasReferences ? (
        <p className="border border-[#e5d7b8] bg-[#fbf7eb] p-4 text-sm leading-6 text-[#66582f]" role="status">
          Trip creation is not available yet because no active categories or destinations are configured. Ask an administrator to add the marketplace reference data.
        </p>
      ) : null}
      <form action={formAction} className="space-y-6">
        {trip ? <input name="tripId" type="hidden" value={trip.id} /> : null}
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold text-[#29382d]">
            Category
            <select className={inputClass} defaultValue={trip?.category_id ?? ""} name="categoryId" required>
              <option disabled value="">Choose category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-semibold text-[#29382d]">
            Destination
            <select className={inputClass} defaultValue={trip?.destination_id ?? ""} name="destinationId" required>
              <option disabled value="">Choose destination</option>
              {destinations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <Field label="Trip title" name="title" defaultValue={trip?.title} maxLength={200} />
        <Field label="Short summary" name="summary" defaultValue={trip?.summary} maxLength={500} />
        <TextArea label="Trip description" name="description" defaultValue={trip?.description} />
        <div className="grid gap-5 md:grid-cols-3">
          <label className="block space-y-2 text-sm font-semibold text-[#29382d]">
            Difficulty
            <select className={inputClass} defaultValue={trip?.difficulty ?? "moderate"} name="difficulty">
              <option value="easy">Easy</option><option value="moderate">Moderate</option><option value="challenging">Challenging</option>
            </select>
          </label>
          <Field label="Duration (minutes)" name="durationMinutes" type="number" min={1} defaultValue={trip?.duration_minutes ?? 1440} />
          <Field label="Capacity" name="capacity" type="number" min={1} defaultValue={trip?.capacity ?? 8} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Starts at" name="startsAt" type="datetime-local" defaultValue={localDateTime(trip?.starts_at)} />
          <Field label="Ends at" name="endsAt" type="datetime-local" defaultValue={localDateTime(trip?.ends_at)} />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Departure location" name="departureLocation" defaultValue={trip?.departure_location} maxLength={500} />
          <Field label="Price (MMK per person)" name="priceMmk" type="number" min={0} defaultValue={trip?.price_mmk ?? 0} />
        </div>
        <TextArea label="Safety information" name="safetyInformation" defaultValue={trip?.safety_information} />
        <TextArea label="Cancellation policy" name="cancellationPolicy" defaultValue={trip?.cancellation_policy} />
        <TextArea
          label="Emergency contact information for participants (optional)"
          name="emergencyContactInformation"
          defaultValue={trip?.emergency_contact_information ?? ""}
          required={false}
          maxLength={1000}
        />
        <p className="-mt-4 text-xs leading-5 text-[#73776e]">
          This information is visible to the public after the trip is published. Do not include information you do not want shared publicly.
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          <TextArea label="Included services (one per line)" name="includedServices" defaultValue={trip?.included_services.join("\n")} required={false} />
          <TextArea label="Excluded services (one per line)" name="excludedServices" defaultValue={trip?.excluded_services.join("\n")} required={false} />
          <TextArea label="Required equipment (one per line)" name="requiredEquipment" defaultValue={trip?.required_equipment.join("\n")} required={false} />
        </div>
        {state.error ? <p role="alert" className="text-sm font-medium text-red-800">{state.error}</p> : null}
        {state.message ? <p role="status" className="text-sm font-medium text-[#31513b]">{state.message}</p> : null}
        <button className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending || !hasReferences} type="submit">
          {isPending ? "Saving…" : "Save draft"}
        </button>
      </form>

      {trip && (trip.status === "draft" || trip.status === "rejected") ? (
        <form action={reviewAction} aria-label="Submit trip for review">
          <input name="tripId" type="hidden" value={trip.id} />
          {reviewState.error ? <p className="mb-3 text-sm font-medium text-red-800" role="alert">{reviewState.error}</p> : null}
          <button className="border border-[#294a35] px-5 py-3 text-sm font-semibold text-[#294a35] disabled:opacity-60" disabled={isReviewPending} type="submit">{isReviewPending ? "Submitting…" : "Submit for administrator review"}</button>
        </form>
      ) : null}
    </div>
  );
}
