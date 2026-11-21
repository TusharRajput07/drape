// Shown while a page's code downloads (pages are lazy-loaded, 03 §3): a title bar and a few cards.
export function PageSkeleton() {
  return (
    <div className="wrap" role="status" aria-label="Loading">
      <div className="flex items-center pt-[18px] pb-3">
        <span className="h-6 w-36 animate-pulse rounded-lg bg-soft" />
      </div>
      <div className="mb-4 h-4 w-60 max-w-full animate-pulse rounded bg-soft" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] md:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-soft" />
        ))}
      </div>
    </div>
  );
}
