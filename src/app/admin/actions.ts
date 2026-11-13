"use server";

import { revalidatePath } from "next/cache";
import { formString } from "@/lib/auth/validation";
import { checkAdminAccess } from "@/lib/admin/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminActionState = {
  error?: string;
  message?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorizeAdmin() {
  const supabase = await createSupabaseServerClient({ writeCookies: true });
  const access = await checkAdminAccess(supabase);
  if (!access.user) return { error: access.error } as const;
  return { supabase, user: access.user } as const;
}

function validId(id: string) {
  return UUID_PATTERN.test(id);
}

function rpcErrorMessage(error: { code?: string; message: string }, fallback: string) {
  if (error.code === "42501") return "Administrator access is required to perform this action.";
  if (error.code === "P0002") return "This item could not be found.";
  if (error.code === "23514" || error.code === "22023") {
    return "This item is no longer eligible for that decision. Refresh and review its current status.";
  }
  console.error("Administrator moderation action failed", error);
  return fallback;
}

export async function reviewOrganizerApplication(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const profileId = formString(formData, "profileId");
  const decision = formString(formData, "decision");
  const reason = formString(formData, "reason").trim();
  if (!validId(profileId)) return { error: "Choose a valid organizer application." };
  if (decision !== "verified" && decision !== "rejected") {
    return { error: "Choose a valid organizer decision." };
  }
  if (decision === "rejected" && (reason.length === 0 || reason.length > 2000)) {
    return { error: "Enter a rejection reason between 1 and 2,000 characters." };
  }
  if (decision === "verified" && reason) {
    return { error: "Remove the rejection reason before approving this application." };
  }

  const access = await authorizeAdmin();
  if ("error" in access) return { error: access.error };
  const { error } = await access.supabase.rpc("review_organizer_profile", {
    p_organizer_profile_id: profileId,
    p_status: decision,
    p_reason: decision === "rejected" ? reason : null,
  });
  if (error) {
    return { error: rpcErrorMessage(error, "We could not update this organizer application.") };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/organizers");
  revalidatePath("/admin/actions");
  revalidatePath("/organizer/onboarding");
  return { message: decision === "verified" ? "Organizer application approved." : "Organizer application rejected." };
}

export async function reviewTrip(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const tripId = formString(formData, "tripId");
  const decision = formString(formData, "decision");
  const reason = formString(formData, "reason").trim();
  if (!validId(tripId)) return { error: "Choose a valid trip." };
  if (decision !== "approve" && decision !== "reject") {
    return { error: "Choose a valid trip decision." };
  }
  if (decision === "reject" && (reason.length === 0 || reason.length > 2000)) {
    return { error: "Enter a rejection reason between 1 and 2,000 characters." };
  }

  const access = await authorizeAdmin();
  if ("error" in access) return { error: access.error };
  const result = decision === "approve"
    ? await access.supabase.rpc("approve_trip", { p_trip_id: tripId })
    : await access.supabase.rpc("reject_trip", { p_trip_id: tripId, p_reason: reason });
  if (result.error) {
    return { error: rpcErrorMessage(result.error, "We could not update this trip.") };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/trips");
  revalidatePath("/admin/actions");
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/organizer/trips");
  return { message: decision === "approve" ? "Trip approved and published." : "Trip rejected with feedback for its organizer." };
}

export async function resolveReport(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const reportId = formString(formData, "reportId");
  const decision = formString(formData, "decision");
  const notes = formString(formData, "notes").trim();
  if (!validId(reportId)) return { error: "Choose a valid report." };
  if (decision !== "reviewed" && decision !== "dismissed") {
    return { error: "Choose a valid report resolution." };
  }
  if (notes.length > 5000) return { error: "Moderation notes must be 5,000 characters or fewer." };

  const access = await authorizeAdmin();
  if ("error" in access) return { error: access.error };
  const { error } = await access.supabase.rpc("resolve_report", {
    p_report_id: reportId,
    p_status: decision,
    p_notes: notes || null,
  });
  if (error) {
    return { error: rpcErrorMessage(error, "We could not resolve this report.") };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/actions");
  revalidatePath("/account/reports");
  revalidatePath("/notifications");
  return { message: decision === "reviewed" ? "Report marked as reviewed." : "Report dismissed." };
}
