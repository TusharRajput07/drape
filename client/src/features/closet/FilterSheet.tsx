import { Chip } from '@/components/Chip';
import { ColorGrid } from '@/components/ColorGrid';
import { SwitchRow } from '@/components/SwitchRow';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useStats } from '@/features/stats/stats.api';
import { useSubcategories } from '@/features/subcategories/subcategories.api';
import { LABEL } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { useCategories } from './lookups.api';
import { type Sort, useFiltersStore } from './filters.store';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; shown: number };

const label = 'text-[13px] font-medium';

// Subcategory, colour, liked only, not in any outfit, sort (03 §6.2). Filters apply as they're tapped;
// only colours and subcategories this tab actually has are offered.
export function FilterSheet({ open, onOpenChange, shown }: Props) {
  const f = useFiltersStore();
  const category = f.tab === 'all' ? undefined : f.tab;
  const colors = useStats(category).data?.composition.byColor.map((c) => c.color) ?? [];
  const categoryId = useCategories().data?.find((c) => c.slug === category)?.id;
  const subcategories =
    useSubcategories().data?.filter(
      (s) => (s.itemCount ?? 0) > 0 && (!categoryId || s.categoryId === categoryId),
    ) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle>Filter</SheetTitle>
        <SheetDescription>{category ? LABEL[category] : 'All clothes'}</SheetDescription>

        <div className="grid gap-1.5">
          <span className={label}>Colour</span>
          {colors.length ? (
            <ColorGrid
              colors={colors}
              isOn={(id) => f.colorIds.includes(id)}
              onPick={f.toggleColor}
            />
          ) : (
            <p className="mt-2.5 text-[12.5px] text-muted">No colours yet.</p>
          )}
        </div>

        {subcategories.length > 0 && (
          <div className="mt-3.5 grid gap-1.5">
            <span className={label}>Subcategory</span>
            <div className="flex flex-wrap gap-2">
              {subcategories.map((s) => (
                <Chip
                  key={s.id}
                  on={f.subcategoryIds.includes(s.id)}
                  onClick={() => f.toggleSubcategory(s.id)}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className={cn(label, 'mt-3.5')}>Show</div>
        <SwitchRow checked={f.liked} onChange={f.setLiked} label="Liked only" />
        <SwitchRow checked={f.unused} onChange={f.setUnused} label="Not in any outfit" />

        <div className="mt-3.5 grid justify-items-start gap-1.5">
          <span className={label}>Sort</span>
          <Segmented
            value={f.sort}
            onChange={f.setSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
            ]}
          />
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button variant="ghost" className="flex-1" onClick={f.clear}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Show {shown} {shown === 1 ? 'item' : 'items'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: Sort;
  onChange: (v: Sort) => void;
  options: { value: Sort; label: string }[];
}) {
  return (
    <div role="group" aria-label="Sort" className="inline-flex rounded-full bg-soft p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-[34px] rounded-full px-3.5 text-[13px] text-muted',
            value === o.value &&
              'bg-background font-medium text-foreground shadow-[0_0_0_1px_var(--border)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
