import Link from "next/link";
import { redirect } from "next/navigation";
import { TripDashboard } from "@/components/organizer/trip-dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { requireOrganizerProfileId } from "@/lib/organizer/access";

export const instant = false;

export default async function OrganizerTripsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError && !isUnauthenticatedSessionError(userError)) {
    throw new Error("Could not verify the current session.", {
      cause: userError,
    });
  }
  if (!userData.user) redirect("/login?next=%2Forganizer%2Ftrips");
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);

  if (rolesError) {
    throw new Error("Could not load organizer permissions.", {
      cause: rolesError,
    });
  }

  const roleNames = (roles ?? []).map(({ role }) => role);
  if (!roleNames.includes("organizer") || roleNames.includes("admin")) {
    return (
      <main className="page-shell py-16">
        <p className="eyebrow mb-3">Organizer workspace</p>
        <h1 className="section-title text-[#27382c]">Your trip dashboard</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[#73776e]">Apply for organizer access to create and manage trips.</p>
        <Link className="mt-6 inline-flex bg-[#294a35] px-5 py-3 text-sm font-semibold text-white" href="/organizer/onboarding">Continue to organizer onboarding</Link>
      </main>
    );
  }

  const profileId = await requireOrganizerProfileId(supabase, userData.user.id);
  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, title, status, starts_at")
    .eq("organizer_profile_id", profileId)
    .order("updated_at", { ascending: false });

  if (tripsError) {
    throw new Error("Could not load editable trips.", { cause: tripsError });
  }

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <p className="eyebrow mb-3">Organizer workspace</p>
      <h1 className="section-title text-[#27382c]">Your trip dashboard</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        View trip progress, update editable drafts, and manage trip images before review.
      </p>
      <Link className="mt-5 inline-flex text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/organizer/trips/requests">
        Review trip requests
      </Link>
      <TripDashboard trips={trips ?? []} />
    </main>
  );
}
