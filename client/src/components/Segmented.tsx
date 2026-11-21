import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  className?: string;
};

// The prototype's two-way (or more) pill switch: the picked option sits on white.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex rounded-full bg-soft p-[3px]', className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-[34px] rounded-full px-3.5 text-[13px] text-muted tabular-nums',
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
