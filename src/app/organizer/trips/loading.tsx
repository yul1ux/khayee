export default function OrganizerTripsLoading() {
  return (
    <main aria-label="Loading organizer trips" className="page-shell min-h-[65vh] animate-pulse py-12 sm:py-16">
      <div className="h-3 w-36 bg-[#e5e3db]" />
      <div className="mt-4 h-10 w-72 bg-[#e5e3db]" />
      <div className="mt-10 border-y border-[#e5e3db]">
        {[0, 1, 2].map((item) => (
          <div className="flex items-center justify-between gap-6 border-b border-[#e5e3db] py-6 last:border-b-0" key={item}>
            <div className="space-y-3">
              <div className="h-4 w-56 bg-[#e5e3db]" />
              <div className="h-3 w-32 bg-[#e5e3db]" />
            </div>
            <div className="h-4 w-28 bg-[#e5e3db]" />
          </div>
        ))}
      </div>
    </main>
  );
}
