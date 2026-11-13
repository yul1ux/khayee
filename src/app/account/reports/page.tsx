import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isUnauthenticatedSessionError } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AccountReportsPage() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError && !isUnauthenticatedSessionError(authError)) {
    throw new Error("Could not verify your account.", { cause: authError });
  }
  if (!auth.user) redirect("/login?next=%2Faccount%2Freports");

  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, trip_id, organizer_profile_id, target_user_id, category, details, status, created_at")
    .eq("reporter_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load your reports.", { cause: error });

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/account/requests">Back to my requests</Link>
      <p className="eyebrow mt-8 mb-3">Your account</p>
      <h1 className="section-title text-[#27382c]">My reports</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#73776e]">
        Your reports are private. We show the status, but not confidential moderation notes or other users’ details.
      </p>
      {(reports ?? []).length === 0 ? (
        <p className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">
          You have not submitted any reports.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-[#e5e3db] border-y border-[#e5e3db]">
          {(reports ?? []).map((report) => {
            const target = report.trip_id
              ? "Trip"
              : report.organizer_profile_id
                ? "Organizer"
                : "Customer";
            return (
              <li className="py-5" key={report.id}>
                <div className="flex flex-wrap justify-between gap-3">
                  <h2 className="font-semibold capitalize text-[#29382d]">
                    {target} · {report.category.replaceAll("_", " ")}
                  </h2>
                  <span className="text-sm capitalize text-[#73776e]">{report.status}</span>
                </div>
                <p className="mt-2 text-xs text-[#73776e]">
                  Submitted {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Yangon" }).format(new Date(report.created_at))}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#51564e]">{report.details}</p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
