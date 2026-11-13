import { OrganizerReviewForm } from "@/components/admin/moderation-forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

type OrganizerVerificationDetails = {
  organizer_profile_id: string;
  contact_email: string | null;
  verification_rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type OrganizerReviewHistory = {
  id: string;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  target_id: string;
};

export default async function AdminOrganizersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: profiles, error: profilesError } = await supabase
    .from("organizer_profiles")
    .select("id, display_name, bio, website_url, verification_status")
    .order("verification_status");
  if (profilesError) throw new Error("Could not load organizer applications.", { cause: profilesError });

  const profileRows = profiles ?? [];
  const profileIds = profileRows.map(({ id }) => id);
  const [detailsResult, actionsResult]: [
    { data: OrganizerVerificationDetails[] | null; error: Error | null },
    { data: OrganizerReviewHistory[] | null; error: Error | null },
  ] = profileIds.length > 0
    ? await Promise.all([
        supabase
          .from("organizer_verification_details")
          .select("organizer_profile_id, contact_email, verification_rejection_reason, reviewed_by, reviewed_at")
          .in("organizer_profile_id", profileIds),
        supabase
          .from("admin_actions")
          .select("id, actor_id, action, details, created_at, target_id")
          .eq("target_kind", "organizer_profile")
          .in("target_id", profileIds)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const relatedError = detailsResult.error ?? actionsResult.error;
  if (relatedError) throw new Error("Could not load organizer review details.", { cause: relatedError });

  const detailsByProfile = new Map((detailsResult.data ?? []).map((detail) => [detail.organizer_profile_id, detail]));
  const historyByProfile = new Map<string, NonNullable<typeof actionsResult.data>>();
  for (const action of actionsResult.data ?? []) {
    const history = historyByProfile.get(action.target_id) ?? [];
    history.push(action);
    historyByProfile.set(action.target_id, history);
  }

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <p className="eyebrow mb-3">Administrator review</p>
      <h1 className="section-title text-[#27382c]">Organizer applications</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        Verification contact details are private and shown only inside this administrator-only area.
      </p>
      {profileRows.length === 0 ? (
        <p className="mt-8 border border-dashed border-[#d9d8cf] px-5 py-8 text-sm text-[#73776e]">No organizer applications yet.</p>
      ) : (
        <ul className="mt-8 space-y-5">
          {profileRows.map((profile) => {
            const details = detailsByProfile.get(profile.id);
            const history = historyByProfile.get(profile.id) ?? [];
            return (
              <li className="border border-[#e5e3db] bg-[#fbfaf7] p-5 sm:p-6" key={profile.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#29382d]">{profile.display_name}</h2>
                    <p className="mt-1 text-sm capitalize text-[#73776e]">Status: {profile.verification_status}</p>
                  </div>
                  <span className="font-mono text-xs text-[#73776e]">{profile.id}</span>
                </div>
                {profile.bio ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[#51564e]">{profile.bio}</p> : null}
                {profile.website_url ? <p className="mt-3 text-sm"><a className="text-[#35503a] underline" href={profile.website_url} rel="noreferrer" target="_blank">{profile.website_url}</a></p> : null}
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-semibold text-[#29382d]">Private contact email</dt><dd className="text-[#51564e]">{details?.contact_email ?? "Not provided"}</dd></div>
                  {details?.reviewed_at ? <div><dt className="font-semibold text-[#29382d]">Last reviewed</dt><dd className="text-[#51564e]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yangon" }).format(new Date(details.reviewed_at))} · {details.reviewed_by}</dd></div> : null}
                </dl>
                {details?.verification_rejection_reason ? <p className="mt-3 text-sm text-[#8a4034]">Latest rejection reason: {details.verification_rejection_reason}</p> : null}
                {profile.verification_status === "pending" ? <OrganizerReviewForm profileId={profile.id} /> : null}
                {history.length > 0 ? (
                  <details className="mt-5 border-t border-[#e5e3db] pt-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#35503a]">Review history ({history.length})</summary>
                    <ul className="mt-3 space-y-2 text-sm text-[#51564e]">
                      {history.map((action) => (
                        <li key={action.id}>
                          {action.action.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Asia/Yangon" }).format(new Date(action.created_at))}
                          {typeof action.details?.reason === "string" ? ` · ${action.details.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
