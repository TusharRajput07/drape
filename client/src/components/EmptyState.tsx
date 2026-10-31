import type { ReactNode } from 'react';

type Props = { title: string; text: string; action?: ReactNode };

export function EmptyState({ title, text, action }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center text-muted">
      <h3 className="mb-1.5 text-[17px] font-semibold text-foreground">{title}</h3>
      <div>{text}</div>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}
