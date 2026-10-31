import { Heart } from 'lucide-react';
import type { Item } from '@/lib/api-types';
import { cn } from '@/lib/utils';

type Props = { item: Item; onOpen: () => void; onLike: () => void };

// Photo + heart only (03 §6.2). The heart sits beside the open button, not inside it.
export function ItemCard({ item, onOpen, onLike }: Props) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-background transition-colors hover:border-[#d4d3ce]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${item.subcategory.name}, open details`}
        className="size-full"
      >
        <img
          src={item.image.url}
          alt=""
          loading="lazy"
          className="size-full object-contain p-[12%]"
        />
      </button>
      <HeartButton liked={item.isLiked} onClick={onLike} className="absolute top-2 right-2" />
    </div>
  );
}

export function HeartButton({
  liked,
  onClick,
  className,
}: {
  liked: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? 'Remove from liked' : 'Add to liked'}
      className={cn(
        'grid size-9 place-items-center rounded-full bg-background/90',
        liked ? 'text-accent' : 'text-foreground',
        className,
      )}
    >
      <Heart
        // Re-mounts on change so the pop plays each time it's liked.
        key={String(liked)}
        className={cn('size-5', liked && 'animate-[pop_.32s_ease] fill-current')}
        strokeWidth={1.8}
        aria-hidden
      />
    </button>
  );
}
