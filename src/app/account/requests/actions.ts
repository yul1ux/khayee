"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizerProfileId, requireSignedInUser } from "@/lib/organizer/access";
import { formString } from "@/lib/auth/validation";
import {
  isTripRequestId,
  validateTripRequest,
} from "@/lib/trip-requests/validation";

export type TripRequestActionState = {
  error?: string;
  message?: string;
};

async function getRoles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.error("Could not load trip request permissions", error);
    return { error: "We could not verify your permissions. Please try again." };
  }
  return { roles: (roles ?? []).map(({ role }) => role) };
}

export async function submitTripRequest(
  _previousState: TripRequestActionState,
  formData: FormData,
): Promise<TripRequestActionState> {
  const tripId = formString(formData, "tripId");
  const partySizeText = formString(formData, "partySize");
  const message = formString(formData, "message").trim();
  const partySize = /^\d+$/.test(partySizeText) ? Number(partySizeText) : Number.NaN;
  const validationError = validateTripRequest(tripId, partySize, message);
  if (validationError) return { error: validationError };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const { roles, error: roleError } = await getRoles(supabase, user.id);
  if (roleError) return { error: roleError };
  if (!roles?.includes("customer")) {
    return { error: "A customer account is required to request this trip." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, organizer_profile_id, starts_at, capacity")
    .eq("id", tripId)
    .eq("status", "published")
    .maybeSingle();
  if (tripError) {
    console.error("Could not verify trip before request", tripError);
    return { error: "We could not verify this trip. Please refresh and try again." };
  }
  if (!trip || new Date(trip.starts_at).getTime() <= Date.now()) {
    return { error: "This trip is no longer accepting requests." };
  }
  const { data: organizerDetails, error: organizerDetailsError } = await supabase
    .from("organizer_verification_details")
    .select("organizer_profile_id")
    .maybeSingle();
  if (organizerDetailsError) {
    console.error("Could not verify trip ownership before request", organizerDetailsError);
    return { error: "We could not verify trip ownership. Please refresh and try again." };
  }
  if (organizerDetails?.organizer_profile_id === trip.organizer_profile_id) {
    return { error: "You cannot request to join your own trip." };
  }
  if (partySize > trip.capacity) {
    return { error: "The participant count cannot exceed the trip capacity." };
  }

  const { error } = await supabase.from("trip_requests").insert({
    trip_id: trip.id,
    party_size: partySize,
    message: message || null,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "You already have an active request for this trip." };
    }
    if (error.code === "23514") {
      return { error: "This trip is unavailable for your request. Check the departure date and participant count." };
    }
    if (error.code === "42501") {
      return { error: "Your account cannot request this trip." };
    }
    console.error("Could not create trip request", error);
    return { error: "We could not submit your request. Please try again." };
  }

  revalidatePath(`/trips/${trip.id}`);
  revalidatePath("/account/requests");
  revalidatePath("/organizer/trips/requests");
  return { message: "Your request has been sent to the organizer." };
}

export async function cancelTripRequest(
  _previousState: TripRequestActionState,
  formData: FormData,
): Promise<TripRequestActionState> {
  const requestId = formString(formData, "requestId");
  if (!isTripRequestId(requestId)) return { error: "This request could not be found." };

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const { roles, error: roleError } = await getRoles(supabase, user.id);
  if (roleError) return { error: roleError };
  if (!roles?.includes("customer")) {
    return { error: "A customer account is required to cancel a request." };
  }

  const { error } = await supabase.rpc("cancel_trip_request", {
    p_request_id: requestId,
  });
  if (error) {
    if (error.code === "42501") {
      return { error: "You do not have permission to cancel this request." };
    }
    if (error.code === "23514") {
      return { error: "Only pending requests can be cancelled." };
    }
    console.error("Could not cancel trip request", error);
    return { error: "We could not cancel this request. Please refresh and try again." };
  }

  revalidatePath("/account/requests");
  revalidatePath("/notifications");
  return { message: "Your request has been cancelled." };
}

export async function respondToTripRequest(
  _previousState: TripRequestActionState,
  formData: FormData,
): Promise<TripRequestActionState> {
  const requestId = formString(formData, "requestId");
  const decision = formString(formData, "decision");
  if (!isTripRequestId(requestId) || !["accept", "reject"].includes(decision)) {
    return { error: "Choose a valid request decision." };
  }

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const { roles, error: roleError } = await getRoles(supabase, user.id);
  if (roleError) return { error: roleError };
  if (!roles?.includes("organizer") || roles.includes("admin")) {
    return { error: "An organizer account is required to review trip requests." };
  }
  await requireOrganizerProfileId(supabase, user.id);

  const rpc = decision === "accept" ? "accept_trip_request" : "reject_trip_request";
  const { error } = await supabase.rpc(rpc, { p_request_id: requestId });
  if (error) {
    if (error.code === "42501") {
      return { error: "You do not have permission to review this request." };
    }
    if (error.code === "23514" && error.message.toLowerCase().includes("capacity")) {
      return { error: "There are not enough places remaining to accept this request." };
    }
    if (error.code === "23514") {
      return { error: "This request is no longer pending or its trip is no longer available." };
    }
    console.error(`Could not ${decision} trip request`, error);
    return { error: "We could not update this request. Please refresh and try again." };
  }

  revalidatePath("/organizer/trips/requests");
  revalidatePath("/organizer/trips");
  revalidatePath("/notifications");
  return { message: decision === "accept" ? "Request accepted." : "Request declined." };
}
