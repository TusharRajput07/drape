import type { Item, Outfit } from '@/lib/api-types';
import { cn } from '@/lib/utils';

// More accessories than this become a "+N" circle, so the column never runs off the card.
const MAX_ACCESSORIES = 4;

// Stacked top → bottom → shoes, the top slightly over the bottom, accessories as small circles on
// the right (03 §6.5).
export function OutfitFigure({ outfit, className }: { outfit: Outfit; className?: string }) {
  const shown = outfit.accessories.slice(0, MAX_ACCESSORIES);
  const more = outfit.accessories.length - shown.length;
  return (
    <div
      className={cn(
        'relative flex aspect-[3/5] flex-col items-center overflow-hidden rounded-[18px] border border-border bg-background px-[8%] pt-[6%] pb-[4%]',
        className,
      )}
    >
      <Slot item={outfit.top} className="relative z-[2] flex-[0_0_34%]" />
      <Slot item={outfit.bottom} className="relative z-[1] -mt-[1%] flex-[0_0_48%]" />
      <Slot item={outfit.shoes} className="flex-[0_0_15%]" imgClassName="max-w-[52%]" />
      {shown.length > 0 && (
        <div className="absolute top-2.5 right-2 z-[3] flex flex-col gap-1.5">
          {shown.map((a) => (
            <span
              key={a.id}
              className="grid size-[30px] place-items-center rounded-full bg-background shadow-[0_0_0_1px_var(--border)]"
            >
              <img src={a.image.url} alt="" loading="lazy" className="size-[72%] object-contain" />
            </span>
          ))}
          {more > 0 && (
            <span className="grid size-[30px] place-items-center rounded-full bg-background text-[11px] font-medium text-muted tabular-nums shadow-[0_0_0_1px_var(--border)]">
              +{more}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Slot({
  item,
  className,
  imgClassName,
}: {
  item: Item | null;
  className: string;
  imgClassName?: string;
}) {
  return (
    <div className={cn('grid min-h-0 w-full place-items-center', className)}>
      {item && (
        <img
          src={item.image.url}
          alt=""
          loading="lazy"
          className={cn('max-h-full max-w-full object-contain', imgClassName)}
        />
      )}
    </div>
  );
}
