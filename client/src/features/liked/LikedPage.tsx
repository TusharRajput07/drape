import { useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { ItemGrid, ItemGridSkeleton } from '@/components/ItemGrid';
import { OutfitGrid, OutfitGridSkeleton } from '@/components/OutfitGrid';
import { PageHeader } from '@/components/PageHeader';
import { Segmented } from '@/components/Segmented';
import { Button } from '@/components/ui/button';
import { ItemDetailSheet } from '@/features/closet/ItemDetailSheet';
import { useItems, useUpdateItem } from '@/features/closet/items.api';
import { OutfitDetailSheet } from '@/features/outfits/OutfitDetailSheet';
import { useFavouriteOutfit, useOutfits } from '@/features/outfits/outfits.api';
import type { Item, Outfit } from '@/lib/api-types';
import { toastError } from '@/lib/errors';

type Tab = 'clothes' | 'outfits';

// Liked clothes | favourite outfits (03 §6.7). Hearts work here too; an unliked card leaves once
// the list refreshes.
export function LikedPage() {
  const [tab, setTab] = useState<Tab>('clothes');
  const items = useItems({ liked: true });
  const outfits = useOutfits(true);
  const update = useUpdateItem();
  const favourite = useFavouriteOutfit();
  const [openItem, setOpenItem] = useState<Item | null>(null);
  const [openOutfit, setOpenOutfit] = useState<Outfit | null>(null);

  const itemList = items.data?.pages.flatMap((p) => p.data) ?? [];
  const outfitList = outfits.data?.pages.flatMap((p) => p.data) ?? [];
  const count = (n: number | undefined) => (n === undefined ? '' : ` · ${n}`);

  const like = (item: Item) =>
    update.mutate({ id: item.id, isLiked: !item.isLiked }, { onError: toastError });
  const toggle = (o: Outfit) =>
    favourite.mutate({ id: o.id, isFavourite: !o.isFavourite }, { onError: toastError });

  const list = tab === 'clothes' ? items : outfits;

  return (
    <section className="wrap">
      <PageHeader title="Liked" />
      <p className="mb-3.5 max-w-[52ch] text-muted">
        The pieces and outfits you keep coming back to.
      </p>
      <Segmented<Tab>
        label="Show"
        className="mb-3"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'clothes', label: `Clothes${count(items.data?.pages[0]?.meta?.total)}` },
          { value: 'outfits', label: `Outfits${count(outfits.data?.pages[0]?.meta?.total)}` },
        ]}
      />

      {list.isPending ? (
        tab === 'clothes' ? (
          <ItemGridSkeleton />
        ) : (
          <OutfitGridSkeleton />
        )
      ) : list.isError ? (
        <EmptyState
          title={`Couldn't load your liked ${tab}`}
          text="Check your connection and try again."
          action={
            <Button variant="ghost" onClick={() => void list.refetch()}>
              Try again
            </Button>
          }
        />
      ) : tab === 'clothes' ? (
        itemList.length ? (
          <ItemGrid
            items={itemList}
            hasMore={!!items.hasNextPage}
            loadingMore={items.isFetchingNextPage}
            onMore={() => void items.fetchNextPage()}
            onOpen={setOpenItem}
            onLike={like}
          />
        ) : (
          <EmptyState title="Nothing liked yet" text="Tap the heart on any item to keep it here." />
        )
      ) : outfitList.length ? (
        <OutfitGrid
          outfits={outfitList}
          hasMore={!!outfits.hasNextPage}
          loadingMore={outfits.isFetchingNextPage}
          onMore={() => void outfits.fetchNextPage()}
          onOpen={setOpenOutfit}
          onFavourite={toggle}
        />
      ) : (
        <EmptyState
          title="No favourite outfits yet"
          text="Tap the heart on an outfit to keep it here."
        />
      )}

      <ItemDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
      <OutfitDetailSheet outfit={openOutfit} onClose={() => setOpenOutfit(null)} />
    </section>
  );
}
