export default function NotificationsLoading() {
  return (
    <main aria-busy="true" className="page-shell min-h-[65vh] py-12 sm:py-16">
      <div className="h-4 w-36 animate-pulse bg-[#f0efe9]" />
      <div className="mt-4 h-10 w-64 animate-pulse bg-[#f0efe9]" />
      <div className="mt-8 h-28 animate-pulse bg-[#f0efe9]" />
      <div className="mt-3 h-28 animate-pulse bg-[#f0efe9]" />
    </main>
  );
}
