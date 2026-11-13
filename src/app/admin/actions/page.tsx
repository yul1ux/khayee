import { AdminActionTable, type AdminActionRow } from "@/components/admin/admin-action-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminActionsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_actions")
    .select("id, actor_id, action, target_kind, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load the moderation audit history.", { cause: error });

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <p className="eyebrow mb-3">Administrator records</p>
      <h1 className="section-title text-[#27382c]">Audit history</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        The latest 100 actions recorded by the database, including actor, target, reason or notes, and timestamp.
      </p>
      <AdminActionTable actions={(data ?? []) as AdminActionRow[]} />
    </main>
  );
}
