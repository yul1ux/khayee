"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  validateTripDraft,
  toPostgresTripInput,
  type TripDraftInput,
} from "@/lib/organizer/trip-validation";
import { requireOrganizerProfileId, requireSignedInUser } from "@/lib/organizer/access";
import { formString } from "@/lib/auth/validation";

export type TripFormState = { error?: string; message?: string };

function readTripInput(formData: FormData): TripDraftInput {
  const list = (name: string) =>
    formString(formData, name)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    categoryId: formString(formData, "categoryId"),
    destinationId: formString(formData, "destinationId"),
    title: formString(formData, "title"),
    summary: formString(formData, "summary"),
    description: formString(formData, "description"),
    difficulty: formString(formData, "difficulty") as TripDraftInput["difficulty"],
    durationMinutes: Number(formString(formData, "durationMinutes")),
    startsAt: formString(formData, "startsAt"),
    endsAt: formString(formData, "endsAt"),
    departureLocation: formString(formData, "departureLocation"),
    capacity: Number(formString(formData, "capacity")),
    priceMmk: Number(formString(formData, "priceMmk")),
    safetyInformation: formString(formData, "safetyInformation"),
    cancellationPolicy: formString(formData, "cancellationPolicy"),
    emergencyContactInformation: formString(formData, "emergencyContactInformation"),
    includedServices: list("includedServices"),
    excludedServices: list("excludedServices"),
    requiredEquipment: list("requiredEquipment"),
  };
}

async function getOrganizerProfileId() {
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const profileId = await requireOrganizerProfileId(supabase, user.id);
  return { supabase, profileId };
}

export async function createTrip(
  _previousState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const input = readTripInput(formData);
  const validationError = validateTripDraft(input);
  if (validationError) return { error: validationError };

  const { supabase, profileId } = await getOrganizerProfileId();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      organizer_profile_id: profileId,
      ...toPostgresTripInput(input),
    })
    .select("id")
    .single();
  if (error) {
    console.error("Could not create organizer trip", error);
    return { error: "Could not save this trip. Check the selected category and destination, then retry." };
  }
  redirect(`/organizer/trips/${data.id}/edit?created=1`);
}

export async function updateTrip(
  _previousState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const tripId = formString(formData, "tripId");
  const input = readTripInput(formData);
  const validationError = validateTripDraft(input);
  if (validationError) return { error: validationError };

  const { supabase, profileId } = await getOrganizerProfileId();
  const { data, error } = await supabase
    .from("trips")
    .update(toPostgresTripInput(input))
    .eq("id", tripId)
    .eq("organizer_profile_id", profileId)
    .in("status", ["draft", "rejected"])
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Could not update organizer trip", error);
    return { error: "This trip could not be updated. It may no longer be editable." };
  }
  return { message: "Trip details saved." };
}

export async function submitTripForReview(
  _previousState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const tripId = formString(formData, "tripId");
  const { supabase, profileId } = await getOrganizerProfileId();
  const { data: organizer, error: organizerError } = await supabase
    .from("organizer_profiles")
    .select("verification_status")
    .eq("id", profileId)
    .maybeSingle();
  if (organizerError) {
    console.error("Could not verify organizer status before trip submission", organizerError);
    return { error: "Could not verify your organizer application. Please refresh and try again." };
  }
  if (!organizer || organizer.verification_status !== "verified") {
    return { error: "Your organizer application must be approved before submitting trips for review." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("organizer_profile_id", profileId)
    .in("status", ["draft", "rejected"])
    .maybeSingle();
  if (tripError) {
    console.error("Could not verify trip before submission", tripError);
    return { error: "Could not verify this trip. Please refresh and try again." };
  }
  if (!trip) return { error: "This trip is not available for submission." };

  const { error } = await supabase.rpc("submit_trip_for_review", { p_trip_id: tripId });
  if (error) {
    console.error("Could not submit trip for administrator review", error);
    return {
      error: "Could not submit this trip. Check that departure is in the future and all details are complete.",
    };
  }
  redirect("/organizer/trips?submitted=1");
}
