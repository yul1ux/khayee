import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/marketplace/icon";
import { getMarketplaceAccountContext, getOrganizerNavigationItem } from "@/lib/marketplace/account-context";

const footerLinks = [
  { label: "Explore trips", href: "/#trips" },
  { label: "Trip styles", href: "/#categories" },
  { label: "Destinations", href: "/#destinations" },
  { label: "My requests", href: "/account/requests" },
];

export function MarketplaceFooter() {
  return (
    <footer className="bg-[#1d3426] text-white" id="about">
      <div className="page-shell grid gap-10 py-12 sm:grid-cols-[1.2fr_0.8fr] sm:py-14">
        <div>
          <Link
            aria-label="Khayee home"
            className="focus-ring inline-flex items-center gap-2.5 rounded-sm"
            href="/"
          >
            <span className="flex size-9 items-center justify-center bg-white/10 text-[#e2d9bb]">
              <Icon className="size-[22px]" name="mountain" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-semibold tracking-[-0.03em]">Khayee</span>
              <span className="mt-1 text-[0.62rem] font-semibold tracking-[0.19em] text-white/60 uppercase">
                OUTDOOR
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-[390px] text-sm leading-6 text-white/65">
            A better way to find the trails, trips, and people that make time
            outside matter.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-white/55">
            <Icon className="size-4 text-[#c7bd92]" name="pin" />
            Made for Mandalay. Made for Myanmar.
          </p>
        </div>

        <div className="sm:justify-self-end">
          <p className="text-[0.68rem] font-bold tracking-[0.16em] text-[#d4c997] uppercase">
            Find your way
          </p>
          <nav aria-label="Footer navigation" className="mt-4 grid grid-cols-2 gap-x-9 gap-y-3">
            {footerLinks.slice(0, 3).map((link) => (
              <Link
                className="focus-ring rounded-sm text-sm text-white/70 transition-colors hover:text-white"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </Link>
            ))}
            <Suspense fallback={null}>
              <OrganizerFooterLink />
            </Suspense>
            {footerLinks.slice(3).map((link) => (
              <Link
                className="focus-ring rounded-sm text-sm text-white/70 transition-colors hover:text-white"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="page-shell flex flex-col gap-2 py-4 text-[0.68rem] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>Khayee. Get out there, together.</p>
          <p>Trips are published after organizer and safety review.</p>
        </div>
      </div>
    </footer>
  );
}

async function OrganizerFooterLink() {
  const item = getOrganizerNavigationItem(await getMarketplaceAccountContext());
  if (!item) return null;

  return (
    <Link
      className="focus-ring rounded-sm text-sm text-white/70 transition-colors hover:text-white"
      href={item.href}
    >
      {item.label === "Become an organizer" ? "For organizers" : item.label}
    </Link>
  );
}
