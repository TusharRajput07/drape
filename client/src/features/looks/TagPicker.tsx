import { Check } from 'lucide-react';
import { useState } from 'react';
import { Chip } from '@/components/Chip';
import type { CategorySlug } from '@/lib/api-types';
import { CATEGORY_SLUGS, LABEL, ONE } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { MAX_TAGS } from './looks.api';
import type { Tags } from './use-tags';

type Props = { tags: Tags; disabled?: boolean };

// Category chips over a 4-column grid of the closet; tap to tag or untag (03 §6.9).
export function TagPicker({ tags, disabled }: Props) {
  const [category, setCategory] = useState<CategorySlug | 'all'>('all');
  const { all, ids, toggle, full } = tags;
  const items = (all.data ?? []).filter(
    (it) => category === 'all' || it.category.slug === category,
  );

  if (all.isPending) {
    return (
      <div className="mt-3.5 grid grid-cols-4 gap-2" role="status" aria-label="Loading">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-[14px] bg-soft" />
        ))}
      </div>
    );
  }

  if (all.isError) {
    return (
      <p className="mt-3.5 text-[12.5px] text-muted">
        Couldn't load your clothes.{' '}
        <button
          type="button"
          className="font-medium text-accent underline underline-offset-2"
          onClick={() => void all.refetch()}
        >
          Try again
        </button>
      </p>
    );
  }

  if (!all.data.length) {
    return (
      <p className="mt-3.5 text-[12.5px] text-muted">
        You have no clothes to tag yet. You can still save the look.
      </p>
    );
  }

  return (
    <>
      <div className="mt-3.5 mb-3 flex flex-wrap gap-2">
        {(['all', ...CATEGORY_SLUGS] as const).map((slug) => (
          <Chip key={slug} on={category === slug} onClick={() => setCategory(slug)}>
            {slug === 'all' ? 'All' : LABEL[slug]}
          </Chip>
        ))}
      </div>

      {items.length ? (
        <div className="grid grid-cols-4 gap-2">
          {items.map((it) => {
            const on = ids.includes(it.id);
            return (
              <button
                key={it.id}
                type="button"
                aria-pressed={on}
                aria-label={`${it.subcategory.name} (${ONE[it.category.slug]})`}
                disabled={disabled || (!on && full)}
                onClick={() => toggle(it.id)}
                className={cn(
                  'relative grid aspect-square place-items-center rounded-[14px] border border-border disabled:opacity-35',
                  on && 'border-accent shadow-[0_0_0_1px_var(--accent)]',
                )}
              >
                <img src={it.image.url} alt="" className="size-[74%] object-contain" />
                {on && (
                  <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Check className="size-3" strokeWidth={2.6} aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted">
          {category === 'all' ? 'No clothes yet.' : `No ${LABEL[category].toLowerCase()} yet.`}
        </p>
      )}

      {full && (
        <p className="mt-2.5 text-[12.5px] text-muted">
          A look can have up to {MAX_TAGS} tagged pieces.
        </p>
      )}
    </>
  );
}
