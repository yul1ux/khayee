import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";

export async function requireSignedInUser(
  supabase: SupabaseClient,
  returnPath?: string,
) {
  const { data, error } = await supabase.auth.getUser();
  if (error && !isUnauthenticatedSessionError(error)) {
    throw new Error("Could not verify the current session.", { cause: error });
  }
  if (!data.user) {
    redirect(returnPath ? `/login?next=${encodeURIComponent(returnPath)}` : "/login");
  }
  return data.user;
}

export async function requireOrganizerProfileId(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleError) throw new Error("Could not load organizer permissions.", { cause: roleError });

  const roleNames = (roles ?? []).map(({ role }) => role);
  if (!roleNames.includes("organizer") || roleNames.includes("admin")) {
    redirect("/organizer/onboarding");
  }

  const { data: details, error: detailsError } = await supabase
    .from("organizer_verification_details")
    .select("organizer_profile_id")
    .maybeSingle();
  if (detailsError) throw new Error("Could not load organizer profile.", { cause: detailsError });
  if (!details) throw new Error("Organizer role exists without an organizer profile.");
  return details.organizer_profile_id;
}
