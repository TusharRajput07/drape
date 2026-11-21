import { useMe, useUpdateSettings } from '@/features/profile/me.api';
import { ACCENTS, applyAccent } from '@/lib/accent';
import type { Accent } from '@/lib/api-types';
import { toastError } from '@/lib/errors';
import { cn } from '@/lib/utils';

// Accent swatches (03 §6.11). A tap recolours the whole app at once, then saves.
export function AccentPicker() {
  const me = useMe().data;
  const update = useUpdateSettings();
  const current = me?.settings.accent ?? 'plum';

  const pick = (accent: Accent) => {
    if (accent === current) return;
    applyAccent(accent);
    update.mutate({ accent }, { onError: toastError });
  };

  return (
    <div className="py-3.5">
      <div className="mb-2 text-[13px] font-medium">Accent colour</div>
      <div className="flex flex-wrap gap-2.5">
        {(Object.keys(ACCENTS) as Accent[]).map((id) => {
          const on = id === current;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => pick(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 text-xs text-muted',
                on && 'font-semibold text-foreground',
              )}
            >
              <i
                className={cn(
                  'block size-10 rounded-full shadow-[0_0_0_1px_var(--border)]',
                  on && 'shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]',
                )}
                style={{ background: ACCENTS[id].accent }}
              />
              {ACCENTS[id].name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
