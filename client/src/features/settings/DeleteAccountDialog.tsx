import { Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useDeleteAccount } from '@/features/profile/me.api';
import { ApiError } from '@/lib/api-types';
import { toastError } from '@/lib/errors';

// Delete account: only after typing DELETE (03 §6.11). The server removes every photo too.
export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const remove = useDeleteAccount();

  return (
    <>
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 strokeWidth={1.8} aria-hidden /> Delete account
      </Button>
      <small className="mt-1.5 block text-[12.5px] text-muted">
        Deletes your clothes, outfits, looks, wishlist and photos for good.
      </small>

      <Sheet open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
        <SheetContent>
          <SheetTitle>Delete account?</SheetTitle>
          <SheetDescription>
            This deletes all your clothes, outfits, looks, wishlist, settings and photos. It can't
            be undone.
          </SheetDescription>
          {open && <ConfirmForm remove={remove} onCancel={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ConfirmForm({
  remove,
  onCancel,
}: {
  remove: ReturnType<typeof useDeleteAccount>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const ready = typed.trim() === 'DELETE';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || remove.isPending) return;
    remove.mutate(typed.trim(), {
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'CONFIRMATION_REQUIRED') setError(err.message);
        else toastError(err);
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <FormField
        id="delete-confirm"
        label="Type DELETE to confirm"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          setError('');
        }}
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={error || undefined}
      />
      <div className="mt-5 flex gap-2.5">
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          disabled={remove.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="danger"
          className="flex-1"
          disabled={!ready || remove.isPending}
        >
          {remove.isPending ? 'Deleting…' : 'Delete account'}
        </Button>
      </div>
    </form>
  );
}
