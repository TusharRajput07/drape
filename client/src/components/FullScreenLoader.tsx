export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <span className="size-[22px] animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}
