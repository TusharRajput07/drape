import { Heart, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useEffectEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ColorDot, ColorGrid } from '@/components/ColorGrid';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { SubcategoryPicker } from '@/features/subcategories/SubcategoryPicker';
import { useSubcategories } from '@/features/subcategories/subcategories.api';
import { ApiError, type Item } from '@/lib/api-types';
import { LABEL, ONE } from '@/lib/categories';
import { toastError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { useDeleteItem, useItem, useRefreshItems, useUpdateItem } from './items.api';
import { useColors } from './lookups.api';

type Props = {
  // The card that was tapped: shown at once while the full details load.
  item: Item | null;
  onClose: () => void;
};

type Mode = 'subcategory' | 'color' | 'confirm' | 'blocked' | null;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Photo, subcategory, colour, usage; change subcategory/colour, like, delete (03 §6.3).
export function ItemDetailSheet({ item, onClose }: Props) {
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {item && <ItemDetail key={item.id} tapped={item} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ItemDetail({ tapped, onClose }: { tapped: Item; onClose: () => void }) {
  const navigate = useNavigate();
  const detail = useItem(tapped.id);
  const update = useUpdateItem();
  const remove = useDeleteItem();
  const refreshItems = useRefreshItems();
  const colors = useColors().data ?? [];
  const subcategories = useSubcategories().data;
  const [mode, setMode] = useState<Mode>(null);
  // Usage from a refused delete, which can be newer than the loaded details.
  const [blockedBy, setBlockedBy] = useState<{ outfits: number; looks: number } | null>(null);

  // The item is gone (deleted elsewhere): close, refresh the lists, say so (03 §11).
  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') {
      onClose();
      refreshItems();
    }
    toastError(err);
  };
  const onLoadError = useEffectEvent(handleError);

  useEffect(() => {
    if (detail.error) onLoadError(detail.error);
  }, [detail.error]);

  const item = detail.data ?? tapped;
  const usage = blockedBy ?? detail.data?.usage;
  const one = ONE[item.category.slug].toLowerCase();

  const change = (body: { subcategoryId?: string; colorId?: string }, done: string) => {
    update.mutate(
      { id: item.id, ...body },
      {
        onSuccess: () => {
          setMode(null);
          toast(done);
        },
        onError: handleError,
      },
    );
  };

  const askDelete = () => setMode(usage && usage.outfits + usage.looks > 0 ? 'blocked' : 'confirm');

  const confirmDelete = () => {
    remove.mutate(item.id, {
      onSuccess: () => {
        onClose();
        toast(`${ONE[item.category.slug]} deleted`);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'ITEM_IN_USE') {
          setBlockedBy(err.details as { outfits: number; looks: number });
          setMode('blocked');
        } else handleError(err);
      },
    });
  };

  const where =
    usage &&
    [
      usage.outfits > 0 && plural(usage.outfits, 'outfit', 'outfits'),
      usage.looks > 0 && plural(usage.looks, 'look', 'looks'),
    ]
      .filter(Boolean)
      .join(' and ');

  return (
    <>
      <span className="text-[11px] font-medium tracking-[.09em] text-muted uppercase">
        {LABEL[item.category.slug]}
      </span>
      <SheetTitle>{item.subcategory.name}</SheetTitle>
      <SheetDescription className="sr-only">Details of this {one}</SheetDescription>

      <div className="mt-4 grid aspect-square place-items-center rounded-[18px] border border-border">
        <img src={item.image.url} alt="" className="max-h-[78%] max-w-[78%] object-contain" />
      </div>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Subcategory</dt>
        <dd>
          {item.subcategory.name}
          <LinkButton onClick={() => setMode(mode === 'subcategory' ? null : 'subcategory')}>
            Change
          </LinkButton>
        </dd>
        <dt className="text-muted">Colour</dt>
        <dd className="inline-flex items-center gap-2">
          <ColorDot hex={item.color.hex} className="size-4" />
          {item.color.name}
          <LinkButton onClick={() => setMode(mode === 'color' ? null : 'color')}>Change</LinkButton>
        </dd>
        <dt className="text-muted">In outfits</dt>
        <dd className="tabular-nums">{usage?.outfits ?? '…'}</dd>
        <dt className="text-muted">In looks</dt>
        <dd className="tabular-nums">{usage?.looks ?? '…'}</dd>
      </dl>

      {mode === 'color' && (
        <ColorGrid
          className="mt-3.5"
          colors={colors}
          isOn={(id) => id === item.color.id}
          onPick={(id) =>
            id === item.color.id
              ? setMode(null)
              : change({ colorId: id }, `Colour set to ${colors.find((c) => c.id === id)?.name}`)
          }
        />
      )}

      {mode === 'subcategory' && (
        <div className="mt-3.5">
          <SubcategoryPicker
            categoryId={item.category.id}
            selected={item.subcategory.id}
            disabled={update.isPending}
            onSelect={(id) =>
              id === item.subcategory.id
                ? setMode(null)
                : change(
                    { subcategoryId: id },
                    `Moved to ${subcategories?.find((s) => s.id === id)?.name ?? 'the new subcategory'}`,
                  )
            }
          />
        </div>
      )}

      {mode === 'blocked' ? (
        <ConfirmBox
          text={`This ${one} is in ${where}. Remove it from ${
            usage && usage.outfits + usage.looks === 1 ? 'there' : 'those'
          } first, then delete it.`}
        >
          <Button variant="ghost" className="h-10 flex-1" onClick={() => setMode(null)}>
            OK
          </Button>
          <Button
            className="h-10 flex-1"
            onClick={() => {
              onClose();
              navigate(usage?.outfits ? '/outfits' : '/lookbooks');
            }}
          >
            Open {usage?.outfits ? 'outfits' : 'lookbooks'}
          </Button>
        </ConfirmBox>
      ) : mode === 'confirm' ? (
        <ConfirmBox text={`Delete this ${one}? This can't be undone.`}>
          <Button variant="ghost" className="h-10 flex-1" onClick={() => setMode(null)}>
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
        <div className="mt-5 flex gap-2.5">
          <Button variant="ghost" className="flex-1" disabled={!detail.data} onClick={askDelete}>
            <Trash2 strokeWidth={1.8} aria-hidden /> Delete
          </Button>
          <Button
            className="flex-1"
            aria-pressed={item.isLiked}
            onClick={() =>
              update.mutate({ id: item.id, isLiked: !item.isLiked }, { onError: handleError })
            }
          >
            <Heart strokeWidth={1.8} className={cn(item.isLiked && 'fill-current')} aria-hidden />
            {item.isLiked ? 'Liked' : 'Like'}
          </Button>
        </div>
      )}
    </>
  );
}

function LinkButton(props: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      className="ml-1 text-[13px] font-medium text-accent underline underline-offset-2"
      {...props}
    />
  );
}

function ConfirmBox({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-[14px] bg-soft p-3.5">
      <p className="mb-2.5">{text}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
