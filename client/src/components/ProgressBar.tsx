// A thin accent bar for upload and download progress (`fraction` 0–1).
export function ProgressBar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded bg-soft"
    >
      <span
        className="block h-full rounded bg-accent transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
