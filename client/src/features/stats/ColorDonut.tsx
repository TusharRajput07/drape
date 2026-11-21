import type { Stats } from '@/lib/api-types';

type Rows = Stats['composition']['byColor'];

const CX = 100;
const CY = 100;
const OUTER = 94;
const INNER = 64;

const point = (r: number, a: number) =>
  `${(CX + r * Math.sin(a)).toFixed(2)} ${(CY - r * Math.cos(a)).toFixed(2)}`;

// One ring slice from angle a0 to a1 (radians, clockwise from 12 o'clock).
function arc(a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${point(OUTER, a0)} A${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, a1)} L${point(INNER, a1)} A${INNER} ${INNER} 0 ${large} 0 ${point(INNER, a0)}Z`;
}

// The whole ring (one colour): two circles, the inner one cut out with evenodd, so no seam shows.
const circle = (r: number) =>
  `M${CX} ${CY - r} A${r} ${r} 0 1 1 ${CX} ${CY + r} A${r} ${r} 0 1 1 ${CX} ${CY - r}Z`;
const RING = circle(OUTER) + circle(INNER);

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

// Colour mix as a ring in each colour's real hex, small gaps between slices, the total in the
// middle and a legend beside it (03 §6.10). Plain SVG, as in the prototype.
export function ColorDonut({ rows, total }: { rows: Rows; total: number }) {
  // About 2 px of gap at the outer edge, never more than a quarter of a thin slice.
  const spans = rows.map((r) => (r.count / total) * Math.PI * 2);
  const slices = rows.map((r, i) => {
    const start = spans.slice(0, i).reduce((sum, s) => sum + s, 0);
    const span = spans[i]!;
    const gap = rows.length > 1 ? Math.min(0.012, span / 4) : 0;
    const d = rows.length === 1 ? RING : arc(start + gap, start + span - gap);
    return { r, d };
  });

  return (
    <div className="grid grid-cols-1 items-center justify-items-center gap-5 min-[461px]:grid-cols-[minmax(150px,210px)_minmax(0,1fr)] min-[461px]:justify-items-stretch">
      <div className="relative aspect-square w-full max-w-[210px]">
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label="Colour breakdown, listed next to the chart"
          className="group size-full"
        >
          {slices.map(({ r, d }) => (
            <path
              key={r.color.id}
              d={d}
              fill={r.color.hex}
              fillRule="evenodd"
              stroke="rgba(0,0,0,.14)"
              strokeWidth={1}
              data-tip={`${r.color.name}: ${items(r.count)} (${r.percent}%)`}
              className="transition-opacity group-hover:opacity-40 hover:!opacity-100"
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <b className="text-[28px] leading-none font-semibold tabular-nums">{total}</b>
          <span className="text-xs text-muted">{total === 1 ? 'item' : 'items'}</span>
        </div>
      </div>

      <ul className="grid w-full min-w-0 gap-[7px]">
        {rows.map((r) => (
          <li
            key={r.color.id}
            className="grid grid-cols-[12px_minmax(0,1fr)_auto_40px] items-center gap-2.5 text-[13.5px]"
          >
            <span
              className="size-3 rounded shadow-[inset_0_0_0_1px_rgba(0,0,0,.14)]"
              style={{ background: r.color.hex }}
              aria-hidden
            />
            <span className="truncate">{r.color.name}</span>
            <span className="text-muted tabular-nums">{r.count}</span>
            <span className="text-right font-semibold tabular-nums">{r.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
