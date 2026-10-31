import type { Item } from '@/lib/api-types';
import { InfiniteSentinel } from './InfiniteSentinel';
import { ItemCard } from './ItemCard';

type Props = {
  items: Item[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onOpen: (item: Item) => void;
  onLike: (item: Item) => void;
};

// Infinite-scroll grid of item cards: 2 columns on phones, more as width allows (03 §7).
export function ItemGrid({ items, hasMore, loadingMore, onMore, onOpen, onLike }: Props) {
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] md:gap-4">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onLike={() => onLike(item)}
          />
        ))}
      </div>
      <InfiniteSentinel hasMore={hasMore} loading={loadingMore} onMore={onMore} />
    </>
  );
}
