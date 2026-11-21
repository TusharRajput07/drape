import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { OutfitGrid, OutfitGridSkeleton } from '@/components/OutfitGrid';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { WeatherCard } from '@/features/weather/WeatherCard';
import type { Outfit } from '@/lib/api-types';
import { toastError } from '@/lib/errors';
import { OutfitDetailSheet } from './OutfitDetailSheet';
import { useFavouriteOutfit, useOutfits } from './outfits.api';

// "My outfits": header, the count, the weather card (as in the prototype), then the grid of outfit figures (03 §6.5).
export function OutfitsPage() {
  const list = useOutfits();
  const favourite = useFavouriteOutfit();
  const [open, setOpen] = useState<Outfit | null>(null);

  const outfits = list.data?.pages.flatMap((p) => p.data) ?? [];
  const total = list.data?.pages[0]?.meta?.total;
  const toggle = (o: Outfit) =>
    favourite.mutate({ id: o.id, isFavourite: !o.isFavourite }, { onError: toastError });

  return (
    <section className="wrap">
      <PageHeader
        title="My outfits"
        action={
          <Button asChild size="sm">
            <Link to="/outfits/new">
              <Plus strokeWidth={1.8} aria-hidden /> Create outfit
            </Link>
          </Button>
        }
      />
      {total !== undefined && total > 0 && (
        <p className="mb-3.5 max-w-[60ch] text-muted">
          {total} saved {total === 1 ? 'outfit' : 'outfits'}. Pick one for today.
        </p>
      )}
      <WeatherCard />

      {list.isPending ? (
        <OutfitGridSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="Couldn't load your outfits"
          text="Check your connection and try again."
          action={
            <Button variant="ghost" onClick={() => void list.refetch()}>
              Try again
            </Button>
          }
        />
      ) : outfits.length ? (
        <OutfitGrid
          outfits={outfits}
          hasMore={!!list.hasNextPage}
          loadingMore={list.isFetchingNextPage}
          onMore={() => void list.fetchNextPage()}
          onOpen={setOpen}
          onFavourite={toggle}
        />
      ) : (
        <EmptyState
          title="No outfits yet"
          text="Mix your tops, bottoms and shoes, then save the combinations you like."
          action={
            <Button asChild>
              <Link to="/outfits/new">Create your first outfit</Link>
            </Button>
          }
        />
      )}

      <OutfitDetailSheet outfit={open} onClose={() => setOpen(null)} />
    </section>
  );
}
