"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function TripsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Trip search page failed to load", error);
  }, [error]);

  return (
    <main className="page-shell flex min-h-[60vh] flex-col items-start justify-center py-16">
      <p className="eyebrow mb-3">Trip search</p>
      <h1 className="section-title text-[#27382c]">Trips could not be loaded</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[#73776e]">
        Please try again. Your search filters will remain in the address bar.
      </p>
      <div className="mt-6 flex items-center gap-5">
        <button className="bg-[#294a35] px-5 py-3 text-sm font-semibold text-white" onClick={() => reset()} type="button">
          Try again
        </button>
        <Link className="text-sm font-semibold text-[#35503a] underline underline-offset-4" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
