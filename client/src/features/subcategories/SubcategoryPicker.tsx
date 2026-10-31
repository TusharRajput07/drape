import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useCreateSubcategory, useSubcategories } from './subcategories.api';

type Props = {
  categoryId: string;
  selected: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

// Pick one subcategory of a category, or add one inline with "+ New" (03 §6.3, §6.4).
export function SubcategoryPicker({ categoryId, selected, onSelect, disabled }: Props) {
  const subcategories = useSubcategories().data?.filter((s) => s.categoryId === categoryId);
  const create = useCreateSubcategory();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) return setError('Type a name first.');
    create.mutate(
      { categoryId, name: clean },
      {
        onSuccess: (created) => {
          setAdding(false);
          setName('');
          setError('');
          onSelect(created.id);
          toast('Subcategory added');
        },
        onError: (err) => setError(fieldErrors(err).name ?? errorMessage(err)),
      },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {subcategories?.map((s) => (
          <Chip
            key={s.id}
            on={s.id === selected}
            disabled={disabled}
            onClick={() => onSelect(s.id)}
          >
            {s.name}
          </Chip>
        ))}
        <Chip
          disabled={disabled}
          onClick={() => {
            setAdding(true);
            setError('');
          }}
        >
          + New
        </Chip>
      </div>
      {adding && (
        <form className="mt-2.5 flex gap-2" onSubmit={submit} noValidate>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Kurtas"
            aria-label="New subcategory name"
            aria-invalid={error ? true : undefined}
            className="h-[46px] rounded-full px-[18px]"
          />
          <Button type="submit" disabled={create.isPending}>
            Add
          </Button>
        </form>
      )}
      {error && <p className="mx-1 mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
