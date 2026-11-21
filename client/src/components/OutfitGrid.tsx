import type { Outfit } from '@/lib/api-types';
import { InfiniteSentinel } from './InfiniteSentinel';
import { HeartButton } from './ItemCard';
import { OutfitFigure } from './OutfitFigure';

type Props = {
  outfits: Outfit[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onOpen: (outfit: Outfit) => void;
  onFavourite: (outfit: Outfit) => void;
};

// Infinite-scroll grid of outfit cards: the figure with the heart top-left, no name, no date (03 §6.5).
export function OutfitGrid({ outfits, hasMore, loadingMore, onMore, onOpen, onFavourite }: Props) {
  return (
    <>
      <div className={OUTFIT_GRID}>
        {outfits.map((outfit) => (
          <div key={outfit.id} className="relative">
            <button
              type="button"
              onClick={() => onOpen(outfit)}
              aria-label={`${outfit.top.subcategory.name} with ${outfit.bottom.subcategory.name}, open details`}
              className="block w-full text-left"
            >
              <OutfitFigure outfit={outfit} />
            </button>
            <HeartButton
              liked={outfit.isFavourite}
              onClick={() => onFavourite(outfit)}
              labels={['Remove from favourites', 'Add to favourites']}
              className="absolute top-2 left-2 z-[4]"
            />
          </div>
        ))}
      </div>
      <InfiniteSentinel hasMore={hasMore} loading={loadingMore} onMore={onMore} />
    </>
  );
}

export const OUTFIT_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-[18px]';

export function OutfitGridSkeleton() {
  return (
    <div className={OUTFIT_GRID} role="status" aria-label="Loading">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[3/5] animate-pulse rounded-[18px] bg-soft" />
      ))}
    </div>
  );
}
