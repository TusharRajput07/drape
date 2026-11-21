import { Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Chip } from '@/components/Chip';
import { ConfirmBox } from '@/components/ConfirmBox';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useCategories } from '@/features/closet/lookups.api';
import { ApiError, type Category, type Subcategory } from '@/lib/api-types';
import { CATEGORY_SLUGS, LABEL } from '@/lib/categories';
import { errorMessage, fieldErrors, toastError } from '@/lib/errors';
import {
  useCreateSubcategory,
  useDeleteSubcategory,
  useRenameSubcategory,
  useSubcategories,
} from './subcategories.api';

type Target = { category: Category; subcategory: Subcategory | null };

const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;

// Settings → Subcategories: per category, chips with item counts; tap one to rename or delete it,
// "+ Add" for a new one (03 §6.11).
export function ManageSubcategories() {
  const categories = useCategories().data;
  const subcategories = useSubcategories();
  const [target, setTarget] = useState<Target | null>(null);

  if (!categories || !subcategories.data) {
    return subcategories.isError ? (
      <div className="py-3.5 text-sm text-muted">
        Couldn't load your subcategories.{' '}
        <button
          type="button"
          className="font-medium text-accent underline underline-offset-2"
          onClick={() => void subcategories.refetch()}
        >
          Try again
        </button>
      </div>
    ) : (
      <div className="my-3.5 h-24 animate-pulse rounded-xl bg-soft" />
    );
  }

  return (
    <>
      {CATEGORY_SLUGS.map((slug) => {
        const category = categories.find((c) => c.slug === slug);
        if (!category) return null;
        const own = subcategories.data.filter((s) => s.categoryId === category.id);
        return (
          <div key={slug} className="border-b border-border py-3.5 last:border-b-0">
            <div className="mb-2 text-[13px] font-medium">{LABEL[slug]}</div>
            <div className="flex flex-wrap gap-2">
              {own.map((s) => (
                <Chip
                  key={s.id}
                  aria-label={`${s.name}, ${items(s.itemCount ?? 0)}. Edit`}
                  onClick={() => setTarget({ category, subcategory: s })}
                >
                  {s.name} <span className="text-muted">{s.itemCount ?? 0}</span>
                </Chip>
              ))}
              <Chip onClick={() => setTarget({ category, subcategory: null })}>+ Add</Chip>
            </div>
          </div>
        );
      })}
      <SubcategorySheet target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function SubcategorySheet({ target, onClose }: { target: Target | null; onClose: () => void }) {
  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {target && (
          <SubcategoryForm
            key={target.subcategory?.id ?? `new-${target.category.id}`}
            target={target}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SubcategoryForm({ target, onClose }: { target: Target; onClose: () => void }) {
  const { category, subcategory } = target;
  const create = useCreateSubcategory();
  const rename = useRenameSubcategory();
  const remove = useDeleteSubcategory();
  const [name, setName] = useState(subcategory?.name ?? '');
  const [error, setError] = useState('');
  // The "still has N items" message, from the counts or from the server's refusal.
  const [blocked, setBlocked] = useState('');
  const count = subcategory?.itemCount ?? 0;
  const busy = create.isPending || rename.isPending || remove.isPending;

  const onSaveError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') {
      onClose();
      toastError(err);
    } else setError(fieldErrors(err).name ?? errorMessage(err));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setError('Type a name first.');
    setError('');
    if (!subcategory) {
      create.mutate(
        { categoryId: category.id, name: clean },
        {
          onSuccess: () => {
            onClose();
            toast('Subcategory added');
          },
          onError: onSaveError,
        },
      );
    } else if (clean === subcategory.name) {
      onClose();
    } else {
      rename.mutate(
        { id: subcategory.id, name: clean },
        {
          onSuccess: () => {
            onClose();
            toast('Subcategory renamed');
          },
          onError: onSaveError,
        },
      );
    }
  };

  const askDelete = () => {
    if (!subcategory) return;
    const message = `"${subcategory.name}" still has ${items(count)}. Move or delete them first.`;
    if (count > 0) return setBlocked(message);
    remove.mutate(subcategory.id, {
      onSuccess: () => {
        onClose();
        toast(`${subcategory.name} deleted`);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'SUBCATEGORY_IN_USE') setBlocked(err.message);
        else {
          if (err instanceof ApiError && err.code === 'NOT_FOUND') onClose();
          toastError(err);
        }
      },
    });
  };

  return (
    <>
      <span className="text-[11px] font-medium tracking-[.09em] text-muted uppercase">
        {LABEL[category.slug]}
      </span>
      <SheetTitle>{subcategory ? 'Edit subcategory' : 'New subcategory'}</SheetTitle>
      <SheetDescription className="sr-only">
        {subcategory
          ? 'Rename or delete this subcategory'
          : `Add a subcategory to ${category.name}`}
      </SheetDescription>

      <form className="mt-4" onSubmit={submit} noValidate>
        <FormField
          id="subcategory-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder="e.g. Kurtas"
          autoComplete="off"
          error={error || undefined}
        />
        {subcategory && (
          <p className="mt-2 text-[13px] text-muted">
            {count} {count === 1 ? 'item uses' : 'items use'} this subcategory.
          </p>
        )}

        {blocked && (
          <ConfirmBox text={blocked}>
            <Button
              type="button"
              variant="ghost"
              className="h-10 flex-1"
              onClick={() => setBlocked('')}
            >
              OK
            </Button>
          </ConfirmBox>
        )}

        <div className="mt-5 flex gap-2.5">
          {subcategory && (
            <Button
              type="button"
              variant="ghost"
              className="flex-1 text-danger"
              disabled={busy}
              onClick={askDelete}
            >
              <Trash2 strokeWidth={1.8} aria-hidden /> Delete
            </Button>
          )}
          <Button type="submit" className="flex-1" disabled={busy}>
            Save
          </Button>
        </div>
      </form>
    </>
  );
}
