import { ReportResolutionForm } from "@/components/admin/moderation-forms";
import { reportCategories } from "@/lib/reports/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type AdminReportsPageProps = {
  searchParams: Promise<{ status?: string; category?: string }>;
};

const reportStatuses = ["pending", "reviewed", "dismissed"] as const;

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const filters = await searchParams;
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("reports")
    .select("id, reporter_id, trip_id, organizer_profile_id, target_user_id, category, details, status, moderation_notes, reviewed_by, reviewed_at, created_at")
    .order("created_at", { ascending: false });
  if (reportStatuses.includes(filters.status as (typeof reportStatuses)[number])) {
    query = query.eq("status", filters.status as (typeof reportStatuses)[number]);
  }
  if (reportCategories.includes(filters.category as (typeof reportCategories)[number])) {
    query = query.eq("category", filters.category as (typeof reportCategories)[number]);
  }
  const { data: reports, error } = await query;
  if (error) throw new Error("Could not load reports.", { cause: error });

  const reportRows = reports ?? [];
  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <p className="eyebrow mb-3">Administrator review</p>
      <h1 className="section-title text-[#27382c]">Safety and conduct reports</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        Report content is private. Resolutions are recorded with the acting administrator and notes in the audit history.
      </p>
      <form className="mt-6 grid gap-3 border border-[#e5e3db] bg-[#fbfaf7] p-4 sm:grid-cols-[1fr_1fr_auto]" method="get">
        <label className="space-y-2 text-sm font-semibold text-[#29382d]">
          Status
          <select className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 font-normal" name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {reportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-[#29382d]">
          Reason
          <select className="w-full border border-[#d9d8cf] bg-white px-3 py-2.5 font-normal" name="category" defaultValue={filters.category ?? ""}>
            <option value="">All reasons</option>
            {reportCategories.map((category) => <option key={category} value={category}>{category.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <button className="self-end bg-[#294a35] px-4 py-2.5 text-sm font-semibold text-white" type="submit">Filter reports</button>
      </form>
      {reportRows.length === 0 ? (
        <p className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">No reports have been filed.</p>
      ) : (
        <ul className="mt-8 space-y-5">
          {reportRows.map((report) => {
            const target = report.trip_id
              ? `Trip · ${report.trip_id}`
              : report.organizer_profile_id
                ? `Organizer profile · ${report.organizer_profile_id}`
                : `User · ${report.target_user_id}`;
            return (
              <li className="border border-[#e5e3db] bg-[#fbfaf7] p-5 sm:p-6" key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold capitalize text-[#29382d]">{report.category.replaceAll("_", " ")}</h2>
                    <p className="mt-1 text-sm text-[#73776e]">{target}</p>
                  </div>
                  <span className="text-sm font-semibold capitalize text-[#8a6c2d]">{report.status}</span>
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-semibold text-[#29382d]">Report ID</dt><dd className="break-all font-mono text-xs text-[#51564e]">{report.id}</dd></div>
                  <div><dt className="font-semibold text-[#29382d]">Reporter ID</dt><dd className="break-all font-mono text-xs text-[#51564e]">{report.reporter_id}</dd></div>
                  <div><dt className="font-semibold text-[#29382d]">Submitted</dt><dd className="text-[#51564e]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yangon" }).format(new Date(report.created_at))}</dd></div>
                  {report.reviewed_at ? <div><dt className="font-semibold text-[#29382d]">Reviewed</dt><dd className="text-[#51564e]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yangon" }).format(new Date(report.reviewed_at))} · {report.reviewed_by}</dd></div> : null}
                </dl>
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[#29382d]">{report.details}</p>
                {report.moderation_notes ? <p className="mt-3 whitespace-pre-line border-l-2 border-[#b8c2a8] pl-3 text-sm text-[#51564e]">Resolution notes: {report.moderation_notes}</p> : null}
                {report.status === "pending" ? <ReportResolutionForm reportId={report.id} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
