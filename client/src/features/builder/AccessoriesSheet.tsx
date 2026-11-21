import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useAllItems } from '@/features/closet/items.api';
import { useRefreshOutfits, useSaveOutfit } from '@/features/outfits/outfits.api';
import { ApiError } from '@/lib/api-types';
import { toastError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useBuilderStore } from './builder.store';

// The server's limit (02 §8.7).
const MAX_ACCESSORIES = 10;

type Pieces = { topId: string; bottomId: string; shoesId: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pieces: Pieces | null;
  // The outfit being edited (PUT keeps its id), or undefined for a new one.
  editId?: string;
};

// Save step: pick any accessories (or skip), then save. A duplicate or invalid outfit is explained
// here and the picks are kept (03 §6.6, §11).
export function AccessoriesSheet({ open, onOpenChange, pieces, editId }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  // Lives here, not in the picker, so a save that's under way still finishes (and leaves the
  // builder); the sheet stays open while saving.
  const save = useSaveOutfit();
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o && save.isPending) return;
        setMessage(null);
        onOpenChange(o);
      }}
    >
      <SheetContent>
        <SheetTitle>Add accessories</SheetTitle>
        <SheetDescription>Pick any that go with this outfit, or skip.</SheetDescription>
        {pieces && (
          <Picker
            pieces={pieces}
            editId={editId}
            save={save}
            message={message}
            setMessage={setMessage}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type PickerProps = {
  pieces: Pieces;
  editId?: string;
  save: ReturnType<typeof useSaveOutfit>;
  message: string | null;
  setMessage: (message: string | null) => void;
};

function Picker({ pieces, editId, save, message, setMessage }: PickerProps) {
  const navigate = useNavigate();
  const accessories = useAllItems({ category: 'accessory' });
  const picked = useBuilderStore((s) => s.accessoryIds);
  const toggle = useBuilderStore((s) => s.toggleAccessory);
  const refreshOutfits = useRefreshOutfits();

  const list = accessories.data ?? [];
  // Picks of accessories that have since been deleted are dropped.
  const ids = picked.filter((id) => list.some((a) => a.id === id));
  const full = ids.length >= MAX_ACCESSORIES;

  const commit = (skip: boolean) => {
    const accessoryIds = skip ? [] : ids;
    setMessage(null);
    save.mutate(
      { id: editId, body: { ...pieces, accessoryIds } },
      {
        onSuccess: () => {
          // Replace, so Back from Outfits doesn't reopen an empty builder.
          navigate('/outfits', { replace: true });
          toast(editId ? 'Outfit updated' : 'Outfit saved');
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'OUTFIT_DUPLICATE') {
            setMessage(
              accessoryIds.length
                ? 'You already saved this outfit. Change the accessories, or go back and change a piece.'
                : 'You already saved this outfit without accessories. Add one, or go back and change a piece.',
            );
          } else if (err instanceof ApiError && err.code === 'OUTFIT_INVALID') {
            setMessage(err.message);
          } else if (err instanceof ApiError && err.code === 'NOT_FOUND' && editId) {
            // The outfit being edited was deleted elsewhere.
            refreshOutfits();
            navigate('/outfits', { replace: true });
            toastError(err);
          } else toastError(err);
        },
      },
    );
  };

  return (
    <>
      {message && (
        <p role="alert" className="-mt-2 mb-3.5 text-[13px] text-danger">
          {message}
        </p>
      )}

      {accessories.isPending ? (
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-soft" />
          ))}
        </div>
      ) : accessories.isError ? (
        <p className="text-[12.5px] text-muted">
          Couldn't load your accessories.{' '}
          <button
            type="button"
            className="font-medium text-accent underline underline-offset-2"
            onClick={() => void accessories.refetch()}
          >
            Try again
          </button>
        </p>
      ) : list.length ? (
        <div className="grid grid-cols-3 gap-2.5">
          {list.map((a) => {
            const on = ids.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={on}
                aria-label={a.subcategory.name}
                disabled={!on && full}
                onClick={() => {
                  setMessage(null);
                  toggle(a.id);
                }}
                className={cn(
                  'relative grid aspect-square place-items-center rounded-[14px] border border-border disabled:opacity-35',
                  on && 'border-accent shadow-[0_0_0_1px_var(--accent)]',
                )}
              >
                <img src={a.image.url} alt="" className="size-[74%] object-contain" />
                {on && (
                  <span className="absolute top-1.5 right-1.5 grid size-[22px] place-items-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted">You have no accessories yet.</p>
      )}
      {full && (
        <p className="mt-2.5 text-[12.5px] text-muted">
          An outfit can have up to {MAX_ACCESSORIES} accessories.
        </p>
      )}

      <div className="mt-5 flex gap-2.5">
        <Button
          variant="ghost"
          className="flex-1"
          disabled={save.isPending}
          onClick={() => commit(true)}
        >
          Skip
        </Button>
        <Button
          className="flex-1"
          // Without the list the picks can't be shown, so only Skip saves until it loads.
          disabled={save.isPending || accessories.isPending || accessories.isError}
          onClick={() => commit(false)}
        >
          {ids.length
            ? `Save with ${ids.length} ${ids.length === 1 ? 'accessory' : 'accessories'}`
            : 'Save outfit'}
        </Button>
      </div>
    </>
  );
}
