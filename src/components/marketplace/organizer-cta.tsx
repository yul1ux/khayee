import { Icon } from "@/components/marketplace/icon";
import Link from "next/link";
import { getMarketplaceAccountContext } from "@/lib/marketplace/account-context";

export async function OrganizerCta() {
  const account = await getMarketplaceAccountContext();
  if (account.roles.includes("admin")) return null;

  if (account.roles.includes("organizer")) {
    if (account.organizerApplicationStatus === "verified") return null;
    const rejected = account.organizerApplicationStatus === "rejected";
    return (
      <section className="bg-[#e9e9df] py-12 sm:py-16" id="organizers">
        <div className="page-shell">
          <div className="border border-[#d9d8cf] bg-[#fbfaf7] p-6 sm:p-8">
            <p className="eyebrow mb-3">Organizer application</p>
            <h2 className="text-xl font-semibold text-[#27382c]">
              {rejected ? "Your application needs an update" : "Your application is under review"}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#73776e]">
              {rejected
                ? "Review the administrator's feedback and update your organizer details."
                : "An administrator will review your organizer information. You can check or update your application at any time."}
            </p>
            <Link
              className="mt-5 inline-flex items-center gap-2 bg-[#294a35] px-5 py-3 text-sm font-semibold text-white"
              href="/organizer/onboarding"
            >
              {rejected ? "Update application" : "View application"}
              <Icon className="size-4" name="arrowRight" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#e9e9df] py-12 sm:py-16" id="organizers">
      <div className="page-shell">
        <div className="grid overflow-hidden bg-[#244734] text-white md:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col items-start justify-center px-7 py-10 sm:px-12 sm:py-14 lg:px-16">
            <p className="mb-4 text-[0.68rem] font-bold tracking-[0.16em] text-[#d4c997] uppercase">
              For local guides & trip hosts
            </p>
            <h2 className="max-w-[460px] font-[family-name:var(--font-geist-sans)] text-[clamp(2rem,4vw,3.4rem)] leading-[1.04] font-medium tracking-[-0.055em]">
              Know a good way out?
            </h2>
            <p className="mt-4 max-w-[430px] text-sm leading-6 text-white/75 sm:text-base sm:leading-7">
              Bring your local knowledge to more people. We&apos;re building a
              community of thoughtful organizers across Myanmar.
            </p>
            <div className="mt-6 flex items-center gap-2 text-xs leading-5 text-white/80">
              <span className="flex size-6 shrink-0 items-center justify-center border border-white/30 text-[#e2d9bb]">
                <Icon className="size-3.5" name="check" />
              </span>
              Every trip is reviewed before it goes live.
            </div>
            <Link
              className="mt-7 inline-flex items-center gap-2 bg-[#e5ddbd] px-5 py-3 text-sm font-semibold text-[#27382c]"
              href={account.user ? "/organizer/onboarding" : "/signup"}
            >
              Apply to become an organizer
              <Icon className="size-4" name="arrowRight" />
            </Link>
          </div>
          <div
            aria-label="Sunlight filtering through a forest"
            className="organizer-photo min-h-[240px] md:min-h-full"
            role="img"
          />
        </div>
      </div>
    </section>
  );
}
