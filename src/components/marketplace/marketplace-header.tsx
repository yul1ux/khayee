import Link from "next/link";
import { LogoutForm } from "@/components/auth/logout-form";
import { Icon } from "@/components/marketplace/icon";
import {
  getMarketplaceAccountContext,
  getOrganizerNavigationItem,
} from "@/lib/marketplace/account-context";

export async function MarketplaceHeader() {
  const account = await getMarketplaceAccountContext();
  const organizerItem = getOrganizerNavigationItem(account);
  const navigation = [
    { label: "Explore trips", href: "/#trips" },
    { label: "Destinations", href: "/#destinations" },
    ...(organizerItem ? [organizerItem] : []),
  ];
  const { user, roles } = account;

  return (
    <header className="relative z-10 border-b border-[#e9e7df] bg-[#fbfaf7]">
      <div className="page-shell flex min-h-[76px] items-center justify-between gap-2 sm:gap-6">
        <Link
          aria-label="Khayee home"
          className="focus-ring flex shrink-0 items-center gap-2.5 rounded-sm"
          href="/"
        >
          <span className="flex size-9 items-center justify-center bg-[#e7eadf] text-[#31513b]">
            <Icon className="size-[22px]" name="mountain" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-semibold tracking-[-0.03em] text-[#26392b]">Khayee</span>
            <span className="mt-1 text-[0.62rem] font-semibold tracking-[0.19em] text-[#777a6d] uppercase">
              OUTDOOR
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          {navigation.map((item) => (
            <Link
              className="focus-ring rounded-sm text-[0.82rem] font-medium text-[#51564e] transition-colors hover:text-[#244734]"
              href={item.href}
              key={item.label}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none border border-[#d9d8cf] px-3 py-2 text-sm font-medium text-[#51564e]">
            Explore
          </summary>
          <nav
            aria-label="Mobile main navigation"
            className="absolute left-0 z-20 mt-2 grid min-w-52 gap-1 border border-[#e5e3db] bg-[#fbfaf7] p-2 shadow-lg"
          >
            {navigation.map((item) => (
              <Link
                className="px-3 py-2 text-sm text-[#51564e] hover:bg-[#f0efe9]"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {user ? (
            <>
              {roles.includes("customer") ? (
                <Link
                  className="hidden rounded-sm px-2 py-2 text-sm font-medium text-[#51564e] transition-colors hover:text-[#244734] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#68794d] sm:inline-flex sm:px-3"
                  href="/account/profile"
                >
                  Profile
                </Link>
              ) : null}
              <details className="group relative">
                <summary className="cursor-pointer list-none rounded-sm px-2 py-2 text-sm font-medium text-[#51564e] hover:text-[#244734] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#68794d] sm:px-3">
                  Menu
                </summary>
                <nav
                  aria-label="Account navigation"
                  className="absolute right-0 z-20 mt-2 grid min-w-48 gap-1 border border-[#e5e3db] bg-[#fbfaf7] p-2 shadow-lg"
                >
                  {roles.includes("customer") ? (
                    <>
                      <Link className="px-3 py-2 text-sm text-[#51564e] hover:bg-[#f0efe9]" href="/account/profile">Profile settings</Link>
                      <Link className="px-3 py-2 text-sm text-[#51564e] hover:bg-[#f0efe9]" href="/account/requests">My requests</Link>
                      <Link className="px-3 py-2 text-sm text-[#51564e] hover:bg-[#f0efe9]" href="/notifications">
                        <span className="inline-flex items-center gap-2">
                          <Icon className="size-4" name="bell" /> Notifications
                        </span>
                      </Link>
                    </>
                  ) : null}
                  {roles.includes("organizer") && !roles.includes("admin") ? (
                    <Link className="px-3 py-2 text-sm text-[#51564e] hover:bg-[#f0efe9]" href="/organizer/trips">
                      Organizer workspace
                    </Link>
                  ) : null}
                  {roles.includes("admin") ? (
                    <Link className="px-3 py-2 text-sm text-[#51564e] hover:bg-[#f0efe9]" href="/admin">Admin</Link>
                  ) : null}
                </nav>
              </details>
              <LogoutForm />
            </>
          ) : (
            <>
              <Link
                className="rounded-sm px-2 py-2 text-sm font-medium text-[#51564e] transition-colors hover:text-[#244734] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#68794d] sm:px-3"
                href="/login"
              >
                Log in
              </Link>
              <Link
                className="rounded-sm bg-[#294a35] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d3c2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#68794d] sm:px-4"
                href="/signup"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
