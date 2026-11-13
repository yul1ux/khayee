import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeAuthReturnPath } from "@/lib/auth/return-path";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection();
  const query = await searchParams;
  const nextPath = getSafeAuthReturnPath(query.next);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error && !isUnauthenticatedSessionError(error)) {
    throw new Error("Could not verify the current session.", { cause: error });
  }
  if (data.user) {
    redirect(nextPath ?? "/");
  }

  return (
    <main className="page-shell flex min-h-[70vh] items-center justify-center py-12">
      <section className="w-full max-w-md border border-[#e5e3db] bg-[#fbfaf7] p-7 sm:p-9">
        <p className="eyebrow mb-3">Your account</p>
        <h1 className="section-title text-[#27382c]">Sign in to Khayee</h1>
        <p className="mt-4 text-sm leading-6 text-[#73776e]">
          Sign in to manage your profile, trip requests, or organizer workspace.
        </p>
        <LoginForm nextPath={nextPath} />
        <p className="mt-6 text-center text-xs text-[#73776e]">
          <Link className="underline underline-offset-4" href="/">
            Return to Khayee
          </Link>
        </p>
      </section>
    </main>
  );
}
