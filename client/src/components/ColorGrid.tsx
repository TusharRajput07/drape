import type { Color } from '@/lib/api-types';
import { cn } from '@/lib/utils';

type Props = {
  colors: Color[];
  isOn: (id: string) => boolean;
  onPick: (id: string) => void;
  className?: string;
};

// Round swatches with names, as in the prototype's colour pickers.
export function ColorGrid({ colors, isOn, onPick, className }: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1.5 gap-y-3',
        className,
      )}
    >
      {colors.map((c) => {
        const on = isOn(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(c.id)}
            className={cn(
              'flex flex-col items-center gap-[5px] text-center text-[11.5px] text-muted',
              on && 'font-semibold text-foreground',
            )}
          >
            <ColorDot
              hex={c.hex}
              className={cn(
                'size-[30px]',
                on &&
                  'shadow-[inset_0_0_0_1px_rgba(0,0,0,.14),0_0_0_2px_var(--background),0_0_0_4px_var(--accent)]',
              )}
            />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

export function ColorDot({ hex, className }: { hex: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'block flex-none rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,.14)]',
        className,
      )}
      style={{ background: hex }}
    />
  );
}
