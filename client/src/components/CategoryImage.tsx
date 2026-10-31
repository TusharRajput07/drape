import { createLucideIcon, LayoutGrid, Watch } from 'lucide-react';
import { useState } from 'react';
import type { CategorySlug } from '@/lib/api-types';
import { cn } from '@/lib/utils';

// lucide has no shirt-with-collar, trousers or shoe drawn like the prototype's; these stand in for the photos.
const ShirtIcon = createLucideIcon('shirt-flat', [
  ['path', { d: 'M8 3 3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z', key: 'a' }],
]);
const TrousersIcon = createLucideIcon('trousers', [
  ['path', { d: 'M7 3h10l1.5 18h-4.5L12 10l-2 11H5.5z', key: 'a' }],
  ['path', { d: 'M7 6.5h10', key: 'b' }],
]);
const ShoeIcon = createLucideIcon('shoe', [
  ['path', { d: 'M3 17V8.5l4 1.5 2.5-2.5 4 5 5.5 1.8a2.5 2.5 0 0 1 2 2.4V17z', key: 'a' }],
  ['path', { d: 'M3 17v2h18v-2', key: 'b' }],
]);

const ICONS = {
  all: LayoutGrid,
  top: ShirtIcon,
  bottom: TrousersIcon,
  shoes: ShoeIcon,
  accessory: Watch,
};

type Props = { slug: CategorySlug | 'all'; className?: string };

// The fixed tab image in a soft circle (03 §6.2). Shows a line icon until the owner's photo is in
// public/categories/<slug>.webp.
export function CategoryImage({ slug, className }: Props) {
  const [missing, setMissing] = useState(false);
  const Icon = ICONS[slug];
  return (
    <span
      className={cn(
        'grid size-[52px] place-items-center rounded-full bg-soft shadow-[0_0_0_1px_var(--border)] transition-shadow',
        className,
      )}
    >
      {missing ? (
        <Icon className="size-[46%] text-muted" strokeWidth={1.6} aria-hidden />
      ) : (
        <img
          src={`/categories/${slug}.webp`}
          alt=""
          className="size-[74%] object-contain"
          onError={() => setMissing(true)}
        />
      )}
    </span>
  );
}
