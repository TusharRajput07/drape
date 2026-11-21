import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmBox } from '@/components/ConfirmBox';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { ApiError, type Item, type Look } from '@/lib/api-types';
import { ONE } from '@/lib/categories';
import { fieldErrors, toastError } from '@/lib/errors';
import { useDeleteLook, useLook, useRefreshLooks, useSetLookItems } from './looks.api';
import { TagPicker } from './TagPicker';
import { saveLabel, useTags } from './use-tags';

type Props = {
  // The card that was tapped: shown at once while the latest version loads.
  look: Look | null;
  onClose: () => void;
  // A tagged piece was tapped: the page swaps this sheet for the item's.
  onOpenItem: (item: Item) => void;
};

type Mode = 'view' | 'confirm' | 'tagging';

// The photo, the tagged pieces, Tag clothes (replaces the tags) and Delete with a confirm (03 §6.9).
export function LookDetailSheet({ look, onClose, onOpenItem }: Props) {
  const [saving, setSaving] = useState(false);
  return (
    <Sheet open={!!look} onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent>
        {look && (
          <LookDetail
            key={look.id}
            tapped={look}
            onClose={onClose}
            onOpenItem={onOpenItem}
            onSavingChange={setSaving}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

type DetailProps = {
  tapped: Look;
  onClose: () => void;
  onOpenItem: (item: Item) => void;
  onSavingChange: (saving: boolean) => void;
};

function LookDetail({ tapped, onClose, onOpenItem, onSavingChange }: DetailProps) {
  const detail = useLook(tapped.id);
  const remove = useDeleteLook();
  const refreshLooks = useRefreshLooks();
  const [mode, setMode] = useState<Mode>('view');

  // The look is gone (deleted elsewhere): close, refresh the list, say so (03 §11).
  const handleError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') {
      onClose();
      refreshLooks();
    }
    toastError(err);
  };
  const onLoadError = useEffectEvent(handleError);

  useEffect(() => {
    if (detail.error) onLoadError(detail.error);
  }, [detail.error]);

  const look = detail.data ?? tapped;

  const confirmDelete = () => {
    remove.mutate(look.id, {
      onSuccess: () => {
        onClose();
        toast('Look deleted');
      },
      onError: handleError,
    });
  };

  if (mode === 'tagging') {
    return (
      <EditTags
        look={look}
        onCancel={() => setMode('view')}
        onSaved={onClose}
        onError={handleError}
        onSavingChange={onSavingChange}
      />
    );
  }

  return (
    <>
      <span className="text-[11px] font-medium tracking-[.09em] text-muted uppercase">
        Lookbook
      </span>
      <SheetTitle>Look</SheetTitle>
      <SheetDescription className="sr-only">
        Your photo and the clothes tagged in it
      </SheetDescription>

      <div className="mt-3.5 grid place-items-center overflow-hidden rounded-[18px] bg-soft">
        <img src={look.image.url} alt="Your look" className="max-h-[52dvh] w-full object-contain" />
      </div>

      <div className="mt-4 grid gap-1.5">
        <span className="text-[13px] font-medium">Tagged clothes</span>
        {look.items.length ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {look.items.map((it) => (
              <button
                key={it.id}
                type="button"
                aria-label={`${it.subcategory.name} (${ONE[it.category.slug]}), open details`}
                onClick={() => onOpenItem(it)}
                className="grid size-16 flex-none place-items-center rounded-xl border border-border hover:border-foreground"
              >
                <img src={it.image.url} alt="" className="size-[78%] object-contain" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">Nothing tagged yet.</p>
        )}
      </div>

      {mode === 'confirm' ? (
        <ConfirmBox text="Delete this look? Your clothes stay in your closet.">
          <Button variant="ghost" className="h-10 flex-1" onClick={() => setMode('view')}>
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
          <Button variant="ghost" className="flex-1" onClick={() => setMode('confirm')}>
            <Trash2 strokeWidth={1.8} aria-hidden /> Delete
          </Button>
          <Button className="flex-1" onClick={() => setMode('tagging')}>
            <Pencil strokeWidth={1.8} aria-hidden /> Tag clothes
          </Button>
        </div>
      )}
    </>
  );
}

type EditTagsProps = {
  look: Look;
  onCancel: () => void;
  onSaved: () => void;
  onError: (err: unknown) => void;
  onSavingChange: (saving: boolean) => void;
};

// Tag clothes: the same picker as a new look, starting from the current tags.
function EditTags({ look, onCancel, onSaved, onError, onSavingChange }: EditTagsProps) {
  const tags = useTags(look.items.map((it) => it.id));
  const setItems = useSetLookItems();

  const save = () => {
    onSavingChange(true);
    setItems.mutate(
      { id: look.id, itemIds: tags.ids },
      {
        onSuccess: () => {
          onSaved();
          toast('Tags saved');
        },
        onError: (err) => {
          const tagError = fieldErrors(err).itemIds;
          if (tagError) toast(tagError);
          else onError(err);
        },
        onSettled: () => onSavingChange(false),
      },
    );
  };

  return (
    <>
      <SheetTitle>Tag clothes</SheetTitle>
      <SheetDescription>
        Tap the clothes you're wearing in this photo. You can skip this.
      </SheetDescription>

      <div className="grid place-items-center overflow-hidden rounded-[18px] bg-soft">
        <img src={look.image.url} alt="Your look" className="max-h-[34dvh] w-full object-contain" />
      </div>

      <TagPicker tags={tags} disabled={setItems.isPending} />

      <div className="mt-5 flex gap-2.5">
        <Button variant="ghost" className="flex-1" disabled={setItems.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          // Saving replaces every tag, so it waits until the current ones can be shown.
          disabled={setItems.isPending || !tags.ready}
          onClick={save}
        >
          {setItems.isPending ? 'Saving…' : saveLabel(tags.ids.length)}
        </Button>
      </div>
    </>
  );
}
