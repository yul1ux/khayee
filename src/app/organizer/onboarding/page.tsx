import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizerOnboardingForm } from "@/components/auth/organizer-onboarding-form";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type OrganizerOnboardingPageProps = {
  searchParams: Promise<{ confirmed?: string }>;
};

export default async function OrganizerOnboardingPage({
  searchParams,
}: OrganizerOnboardingPageProps) {
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && !isUnauthenticatedSessionError(userError)) {
    throw new Error("Could not verify the current session.", { cause: userError });
  }
  if (!userData.user) redirect("/login?next=%2Forganizer%2Fonboarding");

  const { data: roles, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  if (roleError) {
    throw new Error("Could not load account permissions.", { cause: roleError });
  }
  const roleNames = (roles ?? []).map(({ role }) => role);
  if (roleNames.includes("admin")) {
    return (
      <main className="page-shell min-h-[65vh] py-12">
        <h1 className="section-title text-[#27382c]">Organizer onboarding</h1>
        <p className="mt-4 text-sm text-[#73776e]">Administrator accounts cannot submit organizer applications.</p>
      </main>
    );
  }

  let application: {
    profileId: string;
    displayName: string;
    bio: string;
    websiteUrl: string;
    status: "pending" | "verified" | "rejected";
    rejectionReason: string | null;
  } | undefined;
  let contactEmail = userData.user.email ?? "";

  if (roleNames.includes("organizer")) {
    const { data: details, error: detailsError } = await supabase
      .from("organizer_verification_details")
      .select("organizer_profile_id, contact_email, verification_rejection_reason")
      .maybeSingle();
    if (detailsError) {
      throw new Error("Could not load organizer verification status.", { cause: detailsError });
    }
    if (details) {
      const { data: profile, error: profileError } = await supabase
        .from("organizer_profiles")
        .select("id, display_name, bio, website_url, verification_status")
        .eq("id", details.organizer_profile_id)
        .single();
      if (profileError) {
        throw new Error("Could not load organizer profile.", { cause: profileError });
      }
      application = {
        profileId: profile.id,
        displayName: profile.display_name,
        bio: profile.bio ?? "",
        websiteUrl: profile.website_url ?? "",
        status: profile.verification_status,
        rejectionReason: details.verification_rejection_reason,
      };
      contactEmail = details.contact_email ?? contactEmail;
    }
  }

  if (roleNames.includes("organizer") && !application) {
    throw new Error("Organizer role exists without a readable verification profile.");
  }

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/organizer/trips">
        Organizer dashboard
      </Link>
      <p className="eyebrow mt-8 mb-3">Organizer workspace</p>
      <h1 className="section-title text-[#27382c]">
        {application?.status === "pending"
          ? "Organizer application"
          : application?.status === "rejected"
            ? "Update your organizer application"
            : application?.status === "verified"
              ? "Organizer profile"
              : "Become an organizer"}
      </h1>
      <p className="mt-4 mb-8 max-w-2xl text-sm leading-6 text-[#73776e]">
        Submit your public organizer details for administrator review. Your account receives organizer access through the database profile trigger; verification remains pending until an administrator reviews it.
      </p>
      {query.confirmed === "1" ? (
        <p className="mb-6 border border-[#cbd6c0] bg-[#f0f3eb] p-3 text-sm text-[#31513b]" role="status">
          Email confirmed. Your profile is ready.
        </p>
      ) : null}
      <OrganizerOnboardingForm application={application} email={contactEmail} />
    </main>
  );
}
