import Link from "next/link";
import { AdminActionTable, type AdminActionRow } from "@/components/admin/admin-action-table";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const [organizers, trips, reports, audit] = await Promise.all([
    supabase.from("organizer_profiles").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("admin_actions").select("id, action, target_kind, target_id, details, created_at, actor_id").order("created_at", { ascending: false }).limit(5),
  ]);
  const error = organizers.error ?? trips.error ?? reports.error ?? audit.error;
  if (error) throw new Error("Could not load administrator dashboard.", { cause: error });

  const cards = [
    { href: "/admin/organizers", label: "Organizer applications", count: organizers.count ?? 0 },
    { href: "/admin/trips", label: "Trips awaiting review", count: trips.count ?? 0 },
    { href: "/admin/reports", label: "Pending reports", count: reports.count ?? 0 },
  ];

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <p className="eyebrow mb-3">Administration</p>
      <h1 className="section-title text-[#27382c]">Moderation overview</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[#73776e]">
        Review organizer applications and trips, handle safety reports, and inspect the immutable moderation history.
      </p>
      <section aria-label="Items requiring review" className="mt-9 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link className="border border-[#e5e3db] bg-[#fbfaf7] p-5 transition-colors hover:bg-[#f1f0e9]" href={card.href} key={card.href}>
            <p className="text-sm text-[#73776e]">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-[#294a35]">{card.count}</p>
          </Link>
        ))}
      </section>
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold text-[#29382d]">Recent admin actions</h2>
          <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/admin/actions">View history</Link>
        </div>
        <AdminActionTable actions={(audit.data ?? []) as AdminActionRow[]} />
      </section>
    </main>
  );
}
