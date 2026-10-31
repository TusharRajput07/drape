import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
};

// The prototype's full-width switch row: label left, switch right.
export function SwitchRow({ checked, onChange, label, hint, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left text-sm',
        className,
      )}
    >
      <span>
        {label}
        {hint && <small className="block text-[12.5px] text-muted">{hint}</small>}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-10 flex-none rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}
