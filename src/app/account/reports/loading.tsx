export default function AccountReportsLoading() {
  return (
    <main aria-busy="true" className="page-shell min-h-[65vh] py-12 sm:py-16">
      <div className="h-4 w-40 animate-pulse bg-[#f0efe9]" />
      <div className="mt-8 h-4 w-32 animate-pulse bg-[#f0efe9]" />
      <div className="mt-4 h-10 w-56 animate-pulse bg-[#f0efe9]" />
      <div className="mt-8 h-24 animate-pulse bg-[#f0efe9]" />
      <div className="mt-3 h-24 animate-pulse bg-[#f0efe9]" />
    </main>
  );
}
