type Row = { id: string; label: string; count: number; percent: number };

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

// Horizontal bars in the accent, scaled to the biggest row ("By category" / "By subcategory").
export function Bars({ title, rows }: { title: string; rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <h3 className="mb-2.5 text-[13px] font-semibold">{title}</h3>
      <div className="grid gap-2.5">
        {rows.map((r) => (
          <div
            key={r.id}
            data-tip={`${r.label}: ${items(r.count)} (${r.percent}%)`}
            className="grid grid-cols-[92px_minmax(0,1fr)_28px] items-center gap-2.5 text-[13.5px]"
          >
            <span className="truncate">{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded bg-soft">
              <span
                className="block h-full rounded bg-accent"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </span>
            <span className="text-right text-muted tabular-nums">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
