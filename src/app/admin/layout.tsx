import { Suspense } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin/access";

export const instant = false;

const navigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organizers", label: "Organizer applications" },
  { href: "/admin/trips", label: "Trip review" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/actions", label: "Audit history" },
];

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AuthorizedAdminArea>{children}</AuthorizedAdminArea>
    </Suspense>
  );
}

async function AuthorizedAdminArea({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  await requireAdminAccess(supabase, "/admin");

  return (
    <>
      <header className="border-b border-[#e5e3db] bg-[#fbfaf7]">
        <div className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-4 py-3">
          <Link className="font-semibold tracking-tight text-[#29382d]" href="/admin">
            Khayee administration
          </Link>
          <nav aria-label="Administrator navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {navigation.map((item) => (
              <Link className="text-[#51564e] underline-offset-4 hover:underline" href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}

function AdminLoading() {
  return (
    <main aria-busy="true" className="page-shell min-h-[65vh] py-12">
      <div className="h-8 w-64 animate-pulse bg-[#f0efe9]" />
      <div className="mt-8 h-40 animate-pulse bg-[#f0efe9]" />
    </main>
  );
}
