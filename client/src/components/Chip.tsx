import type * as React from 'react';
import { cn } from '@/lib/utils';

// Pill chip; `on` fills it with the accent.
export function Chip({
  on,
  className,
  ...props
}: React.ComponentProps<'button'> & { on?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        'h-[34px] rounded-full border border-border px-3.5 text-[13px] tabular-nums',
        on && 'border-accent bg-accent text-accent-foreground',
        className,
      )}
      {...props}
    />
  );
}
