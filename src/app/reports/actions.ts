"use server";

import { revalidatePath } from "next/cache";
import { formString } from "@/lib/auth/validation";
import {
  requireOrganizerProfileId,
  requireSignedInUser,
} from "@/lib/organizer/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getReportDetails,
  isReportCategory,
  validateReportInput,
} from "@/lib/reports/validation";

export type ReportActionState = {
  error?: string;
  message?: string;
};

async function getRoles(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.error("Could not verify report permissions", error);
    return { error: "We could not verify your account permissions. Please try again." };
  }
  return { roles: (data ?? []).map(({ role }) => role) };
}

export async function submitReport(
  _previousState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  const targetType = formString(formData, "targetType");
  const targetId = formString(formData, "targetId");
  const requestId = formString(formData, "requestId");
  const category = formString(formData, "category");
  const description = formString(formData, "details").trim();
  const validationError = validateReportInput({
    targetType,
    targetId,
    category,
    details: description,
    requestId: requestId || undefined,
  });
  if (validationError || !isReportCategory(category)) {
    return { error: validationError ?? "Choose a valid report reason." };
  }

  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const user = await requireSignedInUser(supabase);
  const { roles, error: roleError } = await getRoles(supabase, user.id);
  if (roleError) return { error: roleError };

  let targetColumns: {
    trip_id?: string;
    organizer_profile_id?: string;
    target_user_id?: string;
  };
  if (targetType === "trip") {
    if (!roles?.includes("customer")) {
      return { error: "A customer account is required to report a trip." };
    }
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, organizer_profile_id")
      .eq("id", targetId)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      console.error("Could not verify report trip target", error);
      return { error: "We could not verify this trip. Please refresh and try again." };
    }
    if (!trip) return { error: "This trip is no longer available to report." };
    const { data: ownProfile, error: ownProfileError } = await supabase
      .from("organizer_verification_details")
      .select("organizer_profile_id")
      .maybeSingle();
    if (ownProfileError) {
      console.error("Could not verify trip report ownership", ownProfileError);
      return { error: "We could not verify your account. Please try again." };
    }
    if (
      ownProfile?.organizer_profile_id &&
      ownProfile.organizer_profile_id === trip.organizer_profile_id
    ) {
      return { error: "You cannot report your own trip." };
    }
    targetColumns = { trip_id: trip.id };
  } else if (targetType === "organizer") {
    if (!roles?.includes("customer")) {
      return { error: "A customer account is required to report an organizer." };
    }
    const { data: organizer, error } = await supabase
      .from("organizer_profiles")
      .select("id")
      .eq("id", targetId)
      .eq("verification_status", "verified")
      .maybeSingle();
    if (error) {
      console.error("Could not verify report organizer target", error);
      return { error: "We could not verify this organizer. Please try again." };
    }
    if (!organizer) return { error: "This organizer is no longer available to report." };
    const { data: ownProfile, error: ownProfileError } = await supabase
      .from("organizer_verification_details")
      .select("organizer_profile_id")
      .maybeSingle();
    if (ownProfileError) {
      console.error("Could not verify report ownership", ownProfileError);
      return { error: "We could not verify your account. Please try again." };
    }
    if (ownProfile?.organizer_profile_id === organizer.id) return { error: "You cannot report your own organizer profile." };
    targetColumns = { organizer_profile_id: organizer.id };
  } else {
    if (!roles?.includes("organizer") || roles.includes("admin")) {
      return { error: "An organizer account is required to report a customer." };
    }
    if (!requestId) return { error: "A valid trip request is required to report a customer." };
    const { data: request, error: requestError } = await supabase
      .from("trip_requests")
      .select("id, trip_id, customer_id")
      .eq("id", requestId)
      .eq("customer_id", targetId)
      .maybeSingle();
    if (requestError) {
      console.error("Could not verify report request target", requestError);
      return { error: "We could not verify this trip request. Please try again." };
    }
    if (!request) return { error: "This customer is not associated with that trip request." };
    const ownOrganizerProfileId = await requireOrganizerProfileId(supabase, user.id);
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id")
      .eq("id", request.trip_id)
      .eq("organizer_profile_id", ownOrganizerProfileId)
      .maybeSingle();
    if (tripError) {
      console.error("Could not verify report trip ownership", tripError);
      return { error: "We could not verify trip ownership. Please try again." };
    }
    if (!trip) return { error: "You cannot report a customer outside your own trip requests." };
    targetColumns = { target_user_id: request.customer_id };
  }

  let duplicateQuery = supabase
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("category", category)
    .eq("status", "pending");
  if (targetColumns.trip_id) duplicateQuery = duplicateQuery.eq("trip_id", targetColumns.trip_id);
  if (targetColumns.organizer_profile_id) duplicateQuery = duplicateQuery.eq("organizer_profile_id", targetColumns.organizer_profile_id);
  if (targetColumns.target_user_id) duplicateQuery = duplicateQuery.eq("target_user_id", targetColumns.target_user_id);
  const { data: existingReport, error: duplicateError } = await duplicateQuery.limit(1).maybeSingle();
  if (duplicateError) {
    console.error("Could not check for duplicate report", duplicateError);
    return { error: "We could not verify whether this report was already submitted." };
  }
  if (existingReport) {
    return { error: "You already have a pending report for this target and reason." };
  }

  const { error: insertError } = await supabase.from("reports").insert({
    reporter_id: user.id,
    ...targetColumns,
    category,
    details: getReportDetails(category, description),
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "You already have a pending report for this target and reason." };
    }
    if (insertError.code === "42501") return { error: "Your account cannot submit this report." };
    if (insertError.code === "23514") return { error: "The report details or target are not valid." };
    console.error("Could not submit report", insertError);
    return { error: "We could not submit your report. Please try again." };
  }

  revalidatePath("/account/reports");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  return { message: "Your report was submitted for review. Thank you for helping keep Khayee safer." };
}
