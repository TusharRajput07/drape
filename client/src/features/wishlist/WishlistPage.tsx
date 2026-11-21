import { ExternalLink, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { InfiniteSentinel } from '@/components/InfiniteSentinel';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ApiError, type WishlistItem } from '@/lib/api-types';
import { toastError } from '@/lib/errors';
import { AddLinkForm } from './AddLinkForm';
import {
  usePendingLinks,
  useRefreshWishlist,
  useRemoveFromWishlist,
  useWishlist,
} from './wishlist.api';

const GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] md:gap-4';

// "www.myntra.com" → "myntra.com", shown on a pending card until the real shop name arrives.
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^(?:www\d?|m)\./, '');
  } catch {
    return '';
  }
}

// Products to buy, saved from a pasted link; tap a card to open the shop (03 §6.8).
export function WishlistPage() {
  const list = useWishlist();
  const pending = usePendingLinks();
  const [removing, setRemoving] = useState<WishlistItem | null>(null);

  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <section className="wrap">
      <PageHeader title="Wishlist" />
      <p className="mb-3.5 max-w-[52ch] text-muted">
        Clothes you want to buy. Tap one to open it on the shop's website.
      </p>
      <AddLinkForm />

      <div className="mt-[18px]">
        {list.isPending ? (
          <div className={GRID} role="status" aria-label="Loading">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-soft" />
            ))}
          </div>
        ) : list.isError ? (
          <EmptyState
            title="Couldn't load your wishlist"
            text="Check your connection and try again."
            action={
              <Button variant="ghost" onClick={() => void list.refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length || pending.length ? (
          <>
            <div className={GRID}>
              {pending.map((p) => (
                <PendingCard key={p.id} host={hostOf(p.url)} />
              ))}
              {items.map((item) => (
                <WishlistCard key={item.id} item={item} onRemove={() => setRemoving(item)} />
              ))}
            </div>
            <InfiniteSentinel
              hasMore={!!list.hasNextPage}
              loading={list.isFetchingNextPage}
              onMore={() => void list.fetchNextPage()}
            />
          </>
        ) : (
          <EmptyState
            title="Your wishlist is empty"
            text="Paste a link to a product you like and it will be saved here."
          />
        )}
      </div>

      <RemoveSheet item={removing} onClose={() => setRemoving(null)} />
    </section>
  );
}

function PendingCard({ host }: { host: string }) {
  return (
    <div aria-busy="true">
      <div className="grid aspect-[4/5] place-items-center rounded-2xl border border-border bg-soft">
        <span className="size-[22px] animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
      <div className="grid gap-0.5 px-1 pt-2">
        <span className="text-[13.5px] font-medium">Getting details…</span>
        <span className="truncate text-[12.5px] text-muted">{host}</span>
      </div>
    </div>
  );
}

function WishlistCard({ item, onRemove }: { item: WishlistItem; onRemove: () => void }) {
  // The server only saves http(s) links; anything else never becomes a live link.
  const href = /^https?:\/\//i.test(item.url) ? item.url : undefined;
  return (
    <div className="relative">
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {item.image ? (
          <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-2xl border border-border">
            <img
              src={item.image.url}
              alt=""
              loading="lazy"
              className="size-full object-contain p-[12%]"
            />
          </div>
        ) : (
          <div className="grid aspect-[4/5] content-center gap-1 rounded-2xl border border-border bg-soft p-3 text-center">
            <span className="text-xl leading-tight font-semibold [overflow-wrap:anywhere]">
              {item.siteName}
            </span>
            <span className="text-[11px] tracking-[.06em] text-muted uppercase">No photo</span>
          </div>
        )}
        <div className="grid gap-0.5 px-1 pt-2">
          <span className="line-clamp-2 text-[13.5px] font-medium">{item.productName}</span>
          <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
            {item.siteName}
            <ExternalLink className="size-[13px]" strokeWidth={1.8} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </span>
        </div>
      </a>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove from wishlist"
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/92 shadow-[0_0_0_1px_var(--border)]"
      >
        <X className="size-4" strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}

// "Remove from wishlist?" → delete (03 §6.8).
function RemoveSheet({ item, onClose }: { item: WishlistItem | null; onClose: () => void }) {
  const remove = useRemoveFromWishlist();
  const refreshWishlist = useRefreshWishlist();

  const confirm = () => {
    if (!item) return;
    remove.mutate(item.id, {
      onSuccess: () => {
        onClose();
        toast('Removed from wishlist');
      },
      onError: (err) => {
        // Already gone (removed on another device): the refreshed list drops it.
        if (err instanceof ApiError && err.code === 'NOT_FOUND') {
          onClose();
          void refreshWishlist();
        }
        toastError(err);
      },
    });
  };

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && !remove.isPending && onClose()}>
      <SheetContent>
        <SheetTitle>Remove from wishlist?</SheetTitle>
        <SheetDescription>
          {item &&
            `“${item.productName}” from ${item.siteName} will be removed from your wishlist.`}
        </SheetDescription>
        <div className="flex gap-2.5">
          <Button variant="ghost" className="flex-1" disabled={remove.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" disabled={remove.isPending} onClick={confirm}>
            Remove
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
