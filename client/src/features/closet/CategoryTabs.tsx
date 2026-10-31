import { CategoryImage } from '@/components/CategoryImage';
import { CATEGORY_SLUGS, LABEL } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { type ClosetTab, useFiltersStore } from './filters.store';

const TABS: { id: ClosetTab; label: string }[] = [
  { id: 'all', label: 'All' },
  ...CATEGORY_SLUGS.map((slug) => ({ id: slug, label: LABEL[slug] })),
];

// Sticky row of round category tabs (03 §6.2). Side padding keeps the active ring from being clipped.
export function CategoryTabs() {
  const tab = useFiltersStore((s) => s.tab);
  const setTab = useFiltersStore((s) => s.setTab);
  return (
    <div className="sticky top-[env(safe-area-inset-top,0px)] z-[5] mt-2.5 border-b border-border bg-background">
      <div className="wrap">
        <div
          role="tablist"
          aria-label="Category"
          className="flex gap-3 overflow-x-auto px-1.5 pt-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map(({ id, label }) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(id)}
                className="flex min-w-[60px] flex-none flex-col items-center gap-1.5"
              >
                <CategoryImage
                  slug={id}
                  className={cn(
                    on && 'shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--accent)]',
                  )}
                />
                <span
                  className={cn(
                    'text-xs tracking-[.01em] text-muted',
                    on && 'font-semibold text-foreground',
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
