import { Heart, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConfirmBox } from '@/components/ConfirmBox';
import { OutfitFigure } from '@/components/OutfitFigure';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ApiError, type Item, type Outfit } from '@/lib/api-types';
import { ONE } from '@/lib/categories';
import { toastError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useDeleteOutfit, useFavouriteOutfit, useOutfit, useRefreshOutfits } from './outfits.api';

type Props = {
  // The card that was tapped: shown at once while the latest version loads.
  outfit: Outfit | null;
  onClose: () => void;
};

// The figure, the list of pieces, and Favourite · Edit · Delete in one row (03 §6.5).
export function OutfitDetailSheet({ outfit, onClose }: Props) {
  return (
    <Sheet open={!!outfit} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {outfit && <OutfitDetail key={outfit.id} tapped={outfit} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function OutfitDetail({ tapped, onClose }: { tapped: Outfit; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useOutfit(tapped.id);
  const favourite = useFavouriteOutfit();
  const remove = useDeleteOutfit();
  const refreshOutfits = useRefreshOutfits();
  const [confirming, setConfirming] = useState(false);

  // The outfit is gone (deleted elsewhere): close, refresh the lists, say so (03 §11).
  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') {
      onClose();
      refreshOutfits();
    }
    toastError(err);
  };
  const onLoadError = useEffectEvent(handleError);

  useEffect(() => {
    if (detail.error) onLoadError(detail.error);
  }, [detail.error]);

  const outfit = detail.data ?? tapped;
  const pieces: Item[] = [
    outfit.top,
    outfit.bottom,
    ...(outfit.shoes ? [outfit.shoes] : []),
    ...outfit.accessories,
  ];

  const confirmDelete = () => {
    remove.mutate(outfit.id, {
      onSuccess: () => {
        onClose();
        toast('Outfit deleted');
      },
      onError: handleError,
    });
  };

  return (
    <>
      <SheetTitle>Outfit</SheetTitle>
      <SheetDescription className="sr-only">The pieces in this outfit</SheetDescription>

      <OutfitFigure outfit={outfit} className="mx-auto mt-4 w-full max-w-[260px]" />

      <ul className="mt-4 grid gap-2">
        {pieces.map((it) => (
          <li key={it.id} className="flex items-center gap-3">
            <span className="grid size-11 flex-none place-items-center rounded-[10px] border border-border">
              <img src={it.image.url} alt="" className="size-[78%] object-contain" />
            </span>
            <span className="min-w-0">
              {it.subcategory.name}
              <span className="ml-1.5 text-[13px] text-muted">{ONE[it.category.slug]}</span>
            </span>
          </li>
        ))}
      </ul>

      {confirming ? (
        <ConfirmBox text="Delete this outfit? Your clothes stay in your closet.">
          <Button variant="ghost" className="h-10 flex-1" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="h-10 flex-1"
            disabled={remove.isPending}
            onClick={confirmDelete}
          >
            Delete
          </Button>
        </ConfirmBox>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button
            variant="ghost"
            className="min-w-0 gap-1.5 px-2.5"
            aria-pressed={outfit.isFavourite}
            onClick={() =>
              favourite.mutate(
                { id: outfit.id, isFavourite: !outfit.isFavourite },
                { onError: handleError },
              )
            }
          >
            <Heart
              strokeWidth={1.8}
              className={cn(outfit.isFavourite && 'fill-current text-accent')}
              aria-hidden
            />
            {outfit.isFavourite ? 'Favourited' : 'Favourite'}
          </Button>
          <Button
            variant="ghost"
            className="min-w-0 gap-1.5 px-2.5"
            onClick={() => {
              onClose();
              navigate(`/outfits/${outfit.id}/edit`);
            }}
          >
            <Pencil strokeWidth={1.8} aria-hidden /> Edit
          </Button>
          <Button
            variant="ghost"
            className="min-w-0 gap-1.5 px-2.5 text-danger"
            onClick={() => setConfirming(true)}
          >
            <Trash2 strokeWidth={1.8} aria-hidden /> Delete
          </Button>
        </div>
      )}
    </>
  );
}
