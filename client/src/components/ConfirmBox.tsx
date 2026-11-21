import type { ReactNode } from 'react';

// A confirmation or "can't do that" box inside a sheet, as in the prototype; the buttons go in `children`.
export function ConfirmBox({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="mt-4 rounded-[14px] bg-soft p-3.5">
      <p className="mb-2.5">{text}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
