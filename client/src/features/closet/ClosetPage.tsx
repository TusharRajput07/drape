import { Camera, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/EmptyState';
import { ItemGrid } from '@/components/ItemGrid';
import { Button } from '@/components/ui/button';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { startUpload } from '@/features/upload/upload.store';
import type { Item } from '@/lib/api-types';
import { LABEL } from '@/lib/categories';
import { toastError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { CategoryTabs } from './CategoryTabs';
import { FilterSheet } from './FilterSheet';
import { activeFilterCount, useFiltersStore } from './filters.store';
import { ItemDetailSheet } from './ItemDetailSheet';
import { type ItemFilters, useItems, useItemTotal, useUpdateItem } from './items.api';

// Home: profile header, category tabs, filter button and the infinite grid (03 §6.2).
export function ClosetPage() {
  const f = useFiltersStore();
  const category = f.tab === 'all' ? undefined : f.tab;
  const filtering = activeFilterCount(f);

  // Only set keys go into the query, so equal filters share one cache entry.
  const filters = useMemo<ItemFilters>(() => {
    const out: ItemFilters = {};
    if (category) out.category = category;
    if (f.subcategoryIds.length) out.subcategoryId = f.subcategoryIds;
    if (f.colorIds.length) out.colorId = f.colorIds;
    if (f.liked) out.liked = true;
    if (f.unused) out.unused = true;
    if (f.sort === 'oldest') out.sort = 'oldest';
    return out;
  }, [category, f.subcategoryIds, f.colorIds, f.liked, f.unused, f.sort]);

  const list = useItems(filters);
  const total = useItemTotal(category).data;
  const update = useUpdateItem();
  const [open, setOpen] = useState<Item | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const items = list.data?.pages.flatMap((p) => p.data) ?? [];
  const shown = list.data?.pages[0]?.meta?.total ?? 0;
  const like = (item: Item) =>
    update.mutate({ id: item.id, isLiked: !item.isLiked }, { onError: toastError });

  return (
    <>
      <div className="wrap">
        <ProfileHeader />
      </div>
      <CategoryTabs />

      <section className="wrap">
        <div className="flex items-baseline justify-between gap-3 pt-[18px] pb-3">
          <h2 className="text-lg">{category ? LABEL[category] : 'All clothes'}</h2>
          {total !== undefined && (
            <div className="flex items-center gap-2.5">
              <span className="text-muted">
                {filtering ? `${shown} of ${total}` : total} {total === 1 ? 'item' : 'items'}
              </span>
              {total > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterOpen(true)}
                  className={cn(
                    'inline-flex h-[34px] items-center gap-1.5 rounded-full border border-border px-3 text-[13px] font-medium',
                    filtering && 'border-accent',
                  )}
                >
                  <SlidersHorizontal className="size-4" strokeWidth={1.8} aria-hidden />
                  Filter
                  {filtering > 0 && (
                    <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-[5px] text-[11px] text-accent-foreground tabular-nums">
                      {filtering}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {list.isPending ? (
          <GridSkeleton />
        ) : list.isError ? (
          <EmptyState
            title="Couldn't load your clothes"
            text="Check your connection and try again."
            action={
              <Button variant="ghost" onClick={() => void list.refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length ? (
          <ItemGrid
            items={items}
            hasMore={!!list.hasNextPage}
            loadingMore={list.isFetchingNextPage}
            onMore={() => void list.fetchNextPage()}
            onOpen={setOpen}
            onLike={like}
          />
        ) : filtering ? (
          <EmptyState
            title="No items match"
            text="Try removing a filter."
            action={
              <Button variant="ghost" onClick={f.clear}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={`No ${category ? LABEL[category].toLowerCase() : 'clothes'} yet`}
            text="Add a photo from your gallery and it will show up here."
            action={
              <Button onClick={() => startUpload(category)}>
                <Camera strokeWidth={1.8} aria-hidden /> Add clothes
              </Button>
            }
          />
        )}
      </section>

      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} shown={shown} />
      <ItemDetailSheet item={open} onClose={() => setOpen(null)} />
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] md:gap-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-soft" />
      ))}
    </div>
  );
}
