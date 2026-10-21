import type * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3.5 text-base outline-none placeholder:text-muted disabled:opacity-50',
        'focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
