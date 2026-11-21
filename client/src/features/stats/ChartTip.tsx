import { type PointerEvent, type ReactNode, useEffect, useState } from 'react';

type Tip = { text: string; x: number; y: number } | null;

// The prototype's chart tooltip: anything inside with `data-tip` shows its text above the pointer,
// on hover and on tap. Scrolling hides it.
export function ChartTipArea({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip>(null);

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, { passive: true });
    return () => window.removeEventListener('scroll', hide);
  }, [tip]);

  const show = (e: PointerEvent) => {
    const el = (e.target as Element).closest?.('[data-tip]');
    const text = el?.getAttribute('data-tip');
    if (!text) return setTip(null);
    setTip({ text, x: Math.min(window.innerWidth - 90, Math.max(90, e.clientX)), y: e.clientY });
  };

  return (
    <div onPointerMove={show} onPointerDown={show} onPointerLeave={() => setTip(null)}>
      {children}
      {tip && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[90] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-foreground px-2.5 py-1.5 text-[12.5px] whitespace-nowrap text-white"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}
