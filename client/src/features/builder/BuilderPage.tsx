import { Check, ChevronLeft, Shuffle } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { type ItemFilters, useAllItems } from '@/features/closet/items.api';
import { useCategories } from '@/features/closet/lookups.api';
import { useOutfit, useRefreshOutfits } from '@/features/outfits/outfits.api';
import { useSubcategories } from '@/features/subcategories/subcategories.api';
import { ApiError, type Item } from '@/lib/api-types';
import { toastError } from '@/lib/errors';
import { AccessoriesSheet } from './AccessoriesSheet';
import { preselect, resetBuilder, type Row, ROWS, useBuilderStore } from './builder.store';
import { BuilderRow } from './BuilderRow';

// Fixed for everyone (03 §6.6).
const BASIS: Record<Row, string> = { top: '30%', bottom: '60%', shoes: '10%' };

// `/outfits/new` and `/outfits/:id/edit`. Each outfit gets a fresh builder.
export function BuilderPage() {
  const { id } = useParams();
  return <Builder key={id ?? 'new'} editId={id} />;
}

const rowFilters = (row: Row, subcategoryId: string | null): ItemFilters =>
  subcategoryId ? { category: row, subcategoryId: [subcategoryId] } : { category: row };

// Full screen, no bottom nav: three rows of tops, bottoms and shoes, Shuffle, and Save (03 §6.6).
function Builder({ editId }: { editId?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const store = useBuilderStore();
  const outfit = useOutfit(editId);
  const refreshOutfits = useRefreshOutfits();
  const categories = useCategories().data;
  const subcategories = useSubcategories().data ?? [];
  const [saving, setSaving] = useState(false);

  const queries = {
    top: useAllItems(rowFilters('top', store.subcategory.top)),
    bottom: useAllItems(rowFilters('bottom', store.subcategory.bottom)),
    shoes: useAllItems(rowFilters('shoes', store.subcategory.shoes)),
  };
  const lists: Record<Row, Item[] | undefined> = {
    top: queries.top.data,
    bottom: queries.bottom.data,
    shoes: queries.shoes.data,
  };

  // Edit mode waits for the outfit and pre-selects its pieces; a new outfit is ready at once.
  const ready = !editId || store.editId === editId;

  // The builder's picks only last while it's open.
  useEffect(() => () => resetBuilder(), []);

  useEffect(() => {
    if (editId && outfit.data && useBuilderStore.getState().editId !== editId) {
      preselect(outfit.data);
    }
  }, [editId, outfit.data]);

  // The outfit was deleted elsewhere (or the link is wrong).
  const onLoadError = useEffectEvent((err: unknown) => {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') refreshOutfits();
    toastError(err);
    navigate('/outfits', { replace: true });
  });
  useEffect(() => {
    if (outfit.error) onLoadError(outfit.error);
  }, [outfit.error]);

  // Each loaded row picks its first item unless its pick is still in the list ("No shoes" stays).
  useEffect(() => {
    if (!ready) return;
    const { picked, pick } = useBuilderStore.getState();
    for (const row of ROWS) {
      const list = lists[row];
      const current = picked[row];
      if (!list || current === null) continue;
      if (current !== undefined && list.some((it) => it.id === current)) continue;
      const first = list[0]?.id;
      if (first !== current) pick(row, first ?? (row === 'shoes' ? null : undefined));
    }
  });

  // The pick of a row, if it's in what the row shows now.
  const current = (row: Row) => {
    const id = store.picked[row];
    return id && lists[row]?.some((it) => it.id === id) ? id : null;
  };
  const topId = current('top');
  const bottomId = current('bottom');
  const canSave = ready && !!topId && !!bottomId && !!lists.shoes;

  const shuffle = () => {
    let moved = 0;
    let lockedOnly = false;
    for (const row of ROWS) {
      const others = (lists[row] ?? []).filter((it) => it.id !== store.picked[row]);
      if (!others.length) continue;
      if (store.locked[row]) {
        lockedOnly = true;
        continue;
      }
      store.pick(row, others[Math.floor(Math.random() * others.length)]!.id);
      moved++;
    }
    // Locked is only the reason when a locked row could otherwise have moved.
    if (!moved) {
      toast(
        lockedOnly ? 'All rows are locked. Unlock one to shuffle.' : 'Add more clothes to shuffle.',
      );
    }
  };

  // Back to wherever the builder was opened from; straight to Outfits when opened from a link.
  const back = () => (location.key === 'default' ? navigate('/outfits') : navigate(-1));

  const categoryId = (row: Row) => categories?.find((c) => c.slug === row)?.id;
  const rowSubcategories = (row: Row) =>
    subcategories.filter(
      (s) =>
        s.categoryId === categoryId(row) &&
        ((s.itemCount ?? 0) > 0 || s.id === store.subcategory[row]),
    );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="flex h-14 flex-none items-center gap-1 border-b border-border pr-[max(8px,env(safe-area-inset-right,0px))] pl-[max(8px,env(safe-area-inset-left,0px))]">
        <Button
          variant="text"
          size="icon"
          className="text-foreground"
          aria-label="Back"
          onClick={back}
        >
          <ChevronLeft className="size-[22px]" strokeWidth={1.8} />
        </Button>
        <h1 className="flex-1 text-[17px]">{editId ? 'Edit outfit' : 'Create outfit'}</h1>
        <Button
          variant="text"
          size="icon"
          className="text-foreground"
          aria-label="Shuffle"
          disabled={!ready}
          onClick={shuffle}
        >
          <Shuffle className="size-[21px]" strokeWidth={1.8} />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {ROWS.map((row) => (
          <BuilderRow
            key={row}
            row={row}
            items={ready ? lists[row] : undefined}
            onRetry={
              queries[row].isError && !lists[row] ? () => void queries[row].refetch() : undefined
            }
            subcategories={rowSubcategories(row)}
            basis={BASIS[row]}
          />
        ))}
      </div>

      <div className="flex flex-none items-center border-t border-border py-3 pr-[max(16px,env(safe-area-inset-right,0px))] pl-[max(16px,env(safe-area-inset-left,0px))]">
        <Button
          className="mx-auto max-w-[520px] flex-1"
          disabled={!canSave}
          onClick={() => setSaving(true)}
        >
          <Check strokeWidth={1.8} aria-hidden /> {editId ? 'Save changes' : 'Save outfit'}
        </Button>
      </div>

      <AccessoriesSheet
        open={saving}
        onOpenChange={setSaving}
        pieces={topId && bottomId ? { topId, bottomId, shoesId: current('shoes') } : null}
        editId={editId}
      />
    </div>
  );
}
