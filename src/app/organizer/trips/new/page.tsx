import Link from "next/link";
import { TripEditor } from "@/components/organizer/trip-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizerProfileId, requireSignedInUser } from "@/lib/organizer/access";

export const instant = false;

export default async function NewOrganizerTripPage() {
  const supabase = await createSupabaseServerClient();
  const user = await requireSignedInUser(supabase, "/organizer/trips/new");
  await requireOrganizerProfileId(supabase, user.id);

  const [categoriesResult, destinationsResult] = await Promise.all([
    supabase.from("trip_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("destinations").select("id, name").eq("is_active", true).order("name"),
  ]);
  if (categoriesResult.error || destinationsResult.error) {
    throw new Error("Could not load trip categories and destinations.", {
      cause: categoriesResult.error ?? destinationsResult.error,
    });
  }

  return (
    <main className="page-shell min-h-[65vh] py-12 sm:py-16">
      <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/organizer/trips">Back to dashboard</Link>
      <p className="eyebrow mt-8 mb-3">Trip workspace</p>
      <h1 className="section-title mb-8 text-[#27382c]">Create a trip draft</h1>
      <TripEditor categories={categoriesResult.data ?? []} destinations={destinationsResult.data ?? []} />
    </main>
  );
}
