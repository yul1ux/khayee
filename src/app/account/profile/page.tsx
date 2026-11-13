import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CustomerProfileForm } from "@/components/account/customer-profile-form";

export const instant = false;

export default async function CustomerProfilePage() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && !isUnauthenticatedSessionError(authError)) {
    throw new Error("Could not verify your account.", { cause: authError });
  }
  if (!auth.user) redirect("/login?next=%2Faccount%2Fprofile");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, phone_number, bio")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error("Could not load your profile.", { cause: error });

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/">Explore trips</Link>
      <p className="eyebrow mt-8 mb-3">Your account</p>
      <h1 className="section-title text-[#27382c]">Profile settings</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#73776e]">
        Manage the details used on your customer account. Organizer verification details and account permissions are managed separately.
      </p>
      {profile ? (
        <CustomerProfileForm
          key={profile.user_id}
          profile={{
            displayName: profile.display_name ?? "",
            phoneNumber: profile.phone_number ?? "",
            bio: profile.bio ?? "",
          }}
        />
      ) : (
        <p className="mt-8 border border-[#e6c6bd] bg-[#fbf1ed] p-5 text-sm text-[#783d32]" role="alert">
          Your profile could not be found. Please sign out and sign in again, or contact support if the issue continues.
        </p>
      )}
      <nav aria-label="Account settings navigation" className="mt-10 flex flex-wrap gap-5 border-t border-[#e5e3db] pt-5 text-sm">
        <Link className="font-semibold text-[#35503a] underline underline-offset-4" href="/account/requests">My trip requests</Link>
        <Link className="font-semibold text-[#35503a] underline underline-offset-4" href="/account/reports">My reports</Link>
        <Link className="font-semibold text-[#35503a] underline underline-offset-4" href="/notifications">Notifications</Link>
      </nav>
    </main>
  );
}
