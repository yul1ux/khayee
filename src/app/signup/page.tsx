import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SignupForm } from "@/components/auth/signup-form";
import { getSafeAuthReturnPath } from "@/lib/auth/return-path";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string; next?: string }>;
}) {
  await connection();
  const query = await searchParams;
  const nextPath = getSafeAuthReturnPath(query.next);
  const setupFailed = query.confirmation === "setup-failed";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && !isUnauthenticatedSessionError(error)) {
    throw new Error("Could not verify the current session.", { cause: error });
  }
  if (data.user && !setupFailed) {
    redirect(nextPath ?? "/");
  }

  return (
    <main className="page-shell flex min-h-[70vh] items-center justify-center py-12">
      <section className="w-full max-w-md border border-[#e5e3db] bg-[#fbfaf7] p-7 sm:p-9">
        <p className="eyebrow mb-3">Join the community</p>
        <h1 className="section-title text-[#27382c]">Create your Khayee account</h1>
        <p className="mt-4 text-sm leading-6 text-[#73776e]">
          Create an account to apply as an organizer and manage your trips.
        </p>
        {query.confirmation === "failed" ? (
          <p className="mt-5 text-sm font-medium text-red-800" role="alert">
            That confirmation link could not be verified. Request a new signup email or sign in if your account is already active.
          </p>
        ) : null}
        {setupFailed ? (
          <p className="mt-5 text-sm font-medium text-red-800" role="alert">
            Your email was confirmed, but account setup could not be completed. Do not register again; contact support for help completing your account.
          </p>
        ) : (
          <SignupForm nextPath={nextPath} />
        )}
        <p className="mt-6 text-center text-xs text-[#73776e]">
          Already have an account?{" "}
          <Link
            className="font-semibold underline underline-offset-4"
            href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          >
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
