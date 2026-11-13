import "server-only";

import type { User } from "@supabase/supabase-js";
import { connection } from "next/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizerApplicationStatus = "pending" | "verified" | "rejected";

export type MarketplaceAccountContext = {
  user: User | null;
  roles: string[];
  organizerApplicationStatus: OrganizerApplicationStatus | null;
};

export async function getMarketplaceAccountContext(): Promise<MarketplaceAccountContext> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && !isUnauthenticatedSessionError(authError)) {
    throw new Error("Could not verify the current session.", { cause: authError });
  }
  if (!auth.user) {
    return { user: null, roles: [], organizerApplicationStatus: null };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);
  if (roleError) {
    throw new Error("Could not load account navigation.", { cause: roleError });
  }
  const roles = (roleRows ?? []).map(({ role }) => role);

  if (!roles.includes("organizer") || roles.includes("admin")) {
    return { user: auth.user, roles, organizerApplicationStatus: null };
  }

  const { data: details, error: detailsError } = await supabase
    .from("organizer_verification_details")
    .select("organizer_profile_id")
    .maybeSingle();
  if (detailsError) {
    throw new Error("Could not load organizer application status.", { cause: detailsError });
  }
  if (!details) {
    throw new Error("Organizer role exists without an organizer verification profile.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("organizer_profiles")
    .select("verification_status")
    .eq("id", details.organizer_profile_id)
    .single();
  if (profileError) {
    throw new Error("Could not load organizer application status.", { cause: profileError });
  }

  return {
    user: auth.user,
    roles,
    organizerApplicationStatus: profile.verification_status,
  };
}

export function getOrganizerNavigationItem({
  user,
  roles,
  organizerApplicationStatus,
}: MarketplaceAccountContext) {
  if (roles.includes("admin")) return null;
  if (roles.includes("organizer")) {
    if (organizerApplicationStatus === "verified") return null;
    if (organizerApplicationStatus === "pending") {
      return { label: "Application pending", href: "/organizer/onboarding" };
    }
    if (organizerApplicationStatus === "rejected") {
      return { label: "Update application", href: "/organizer/onboarding" };
    }
    return { label: "Organizer workspace", href: "/organizer/trips" };
  }
  return {
    label: "Become an organizer",
    href: user ? "/organizer/onboarding" : "/#organizers",
  };
}
