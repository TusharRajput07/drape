import { Lock, LockOpen } from 'lucide-react';
import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import type { Item, Subcategory } from '@/lib/api-types';
import { LABEL } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { type Row, useBuilderStore } from './builder.store';

type Props = {
  row: Row;
  // undefined while loading.
  items: Item[] | undefined;
  // The subcategories of this row's category that have items, for the dropdown.
  subcategories: Subcategory[];
  // Share of the space between header and footer (fixed 30 / 60 / 10, 03 §6.6).
  basis: string;
  // Set when the row's list failed to load.
  onRetry?: () => void;
};

// Rows shorter than this (the shoes row on most phones) tuck the label and lock in tighter.
const TINY = 90;

// One builder row: subcategory dropdown, position, lock, and the snap carousel (03 §6.6).
// The shoes row starts with a "No shoes" slide, since an outfit may have none.
export function BuilderRow({ row, items, subcategories, basis, onRetry }: Props) {
  const picked = useBuilderStore((s) => s.picked[row]);
  const locked = useBuilderStore((s) => s.locked[row]);
  const subcategory = useBuilderStore((s) => s.subcategory[row]);
  const { pick, toggleLock, setSubcategory } = useBuilderStore.getState();
  const ref = useRef<HTMLDivElement>(null);
  const [tiny, setTiny] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setTiny(el.clientHeight < TINY));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const slides: (Item | null)[] = items
    ? row === 'shoes' && items.length
      ? [null, ...items]
      : items
    : [];
  const selected = picked === undefined ? -1 : slides.findIndex((s) => (s?.id ?? null) === picked);
  const position = items?.findIndex((it) => it.id === picked) ?? -1;
  const label = LABEL[row].toLowerCase();
  // With a subcategory picked the category clearly has items; otherwise the loaded list says.
  const hasAny = subcategory !== null || !!items?.length;

  return (
    <div
      ref={ref}
      className="relative min-h-0 border-b border-border last:border-b-0"
      style={{ flex: `0 0 ${basis}` }}
    >
      <span
        className={cn(
          'absolute left-[max(12px,env(safe-area-inset-left,0px))] z-[2] rounded-md bg-background/85 px-1.5 py-0.5 text-[10.5px] font-medium tracking-[.09em] text-muted uppercase tabular-nums',
          tiny ? 'top-0.5' : 'top-1.5',
        )}
      >
        {hasAny ? (
          <select
            value={subcategory ?? ''}
            onChange={(e) => setSubcategory(row, e.target.value || null)}
            aria-label={`Show ${label}`}
            className="max-w-[46vw] cursor-pointer border-0 bg-transparent pr-0.5 text-foreground uppercase [font:inherit] [letter-spacing:inherit]"
          >
            <option value="">All {label}</option>
            {subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          LABEL[row]
        )}
        {position >= 0 && items && (
          <span className="ml-1">
            {position + 1}/{items.length}
          </span>
        )}
      </span>

      {slides.length > 1 && (
        <button
          type="button"
          onClick={() => toggleLock(row)}
          aria-pressed={locked}
          aria-label={`Keep ${label} when shuffling`}
          className={cn(
            'absolute right-[max(8px,env(safe-area-inset-right,0px))] z-[2] grid place-items-center rounded-full',
            locked ? 'bg-accent text-accent-foreground' : 'bg-background/85 text-muted',
            tiny ? 'top-1/2 size-7 -translate-y-1/2' : 'top-1 size-8',
          )}
        >
          {locked ? (
            <Lock className="size-[17px]" strokeWidth={1.8} aria-hidden />
          ) : (
            <LockOpen className="size-[17px]" strokeWidth={1.8} aria-hidden />
          )}
        </button>
      )}

      {!items && onRetry ? (
        <div className="grid h-full place-items-center px-10 text-center text-[13px] text-muted">
          <p>
            Couldn't load your {label}.{' '}
            <button
              type="button"
              className="font-medium text-accent underline underline-offset-2"
              onClick={onRetry}
            >
              Try again
            </button>
          </p>
        </div>
      ) : !items ? (
        <div className="grid h-full place-items-center py-1">
          <span className="aspect-square h-[calc(100%-8px)] animate-pulse rounded-2xl bg-soft" />
        </div>
      ) : slides.length ? (
        // A new list (another subcategory) starts its scroll position afresh.
        <Carousel
          key={subcategory ?? 'all'}
          row={row}
          slides={slides}
          selected={selected}
          onSelect={(i) => pick(row, slides[i]?.id ?? null)}
        />
      ) : (
        <div className="grid h-full place-items-center px-10 text-center text-[13px] text-muted">
          {hasAny ? `No ${label} here.` : `No ${label} yet. Add some from your closet.`}
        </div>
      )}
    </div>
  );
}

type CarouselProps = {
  row: Row;
  slides: (Item | null)[];
  selected: number;
  onSelect: (index: number) => void;
};

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Horizontal scroll-snap: the centred slide is the pick, its neighbours are dimmed. A pick made
// elsewhere (shuffle, a tap, edit mode) scrolls the row to it.
function Carousel({ row, slides, selected, onSelect }: CarouselProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [slideWidth, setSlideWidth] = useState(0);
  // The slide a smooth scroll is heading for; scroll positions on the way there are ignored.
  const heading = useRef<number | null>(null);
  const headingTimer = useRef(0);
  const placedAt = useRef(0);
  const frame = useRef(0);

  // Slides are as tall as the row allows, but at most 60% of its width (as in the prototype).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setSlideWidth(Math.max(36, Math.min((el.clientHeight - 8) * 0.96, el.clientWidth * 0.6))),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      clearTimeout(headingTimer.current);
    };
  }, []);

  const slideEls = () => [...(ref.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])];

  const centred = () => {
    const el = ref.current;
    if (!el) return -1;
    const centre = el.scrollLeft + el.clientWidth / 2;
    let best = -1;
    let bestDistance = Infinity;
    slideEls().forEach((s, i) => {
      const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - centre);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    return best;
  };

  // The first placement and a resize jump; later picks glide.
  useLayoutEffect(() => {
    const el = ref.current;
    const slide = slideEls()[selected];
    if (!el || !slide || !slideWidth) return;
    const smooth = placedAt.current === slideWidth && !reducedMotion();
    placedAt.current = slideWidth;
    if (smooth && centred() === selected) return;
    if (smooth) {
      heading.current = selected;
      clearTimeout(headingTimer.current);
      headingTimer.current = window.setTimeout(() => (heading.current = null), 1000);
    }
    el.scrollTo({
      left: slide.offsetLeft + slide.offsetWidth / 2 - el.clientWidth / 2,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, [selected, slideWidth]);

  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const i = centred();
      if (i < 0) return;
      if (heading.current !== null) {
        if (i !== heading.current) return;
        heading.current = null;
      }
      if (i !== selected) onSelect(i);
    });
  };

  // A finger or wheel takes over from a scroll that's still gliding.
  const takeOver = () => {
    heading.current = null;
  };

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      onPointerDown={takeOver}
      onTouchStart={takeOver}
      onWheel={takeOver}
      className="relative flex h-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ '--sw': `${slideWidth || 160}px` } as CSSProperties}
    >
      <div aria-hidden style={{ flex: '0 0 calc(50% - var(--sw) / 2 - 12px)' }} />
      {slides.map((item, i) => {
        const on = i === selected;
        return (
          <button
            key={item?.id ?? 'none'}
            type="button"
            data-slide
            aria-pressed={on}
            aria-label={item ? item.subcategory.name : 'No shoes'}
            onClick={() => i !== selected && onSelect(i)}
            className={cn(
              'grid min-h-0 snap-center place-items-center transition-[opacity,transform] duration-200',
              on ? 'opacity-100' : 'scale-[.88] opacity-[.32]',
            )}
            style={{ flex: '0 0 var(--sw)' }}
          >
            {item ? (
              <img
                src={item.image.url}
                alt=""
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            ) : (
              <span className="grid aspect-square h-[min(100%,var(--sw))] max-h-16 place-items-center rounded-full border border-dashed border-border px-1 text-center text-[11px] leading-tight text-muted">
                No {row}
              </span>
            )}
          </button>
        );
      })}
      <div aria-hidden style={{ flex: '0 0 calc(50% - var(--sw) / 2 - 12px)' }} />
    </div>
  );
}
