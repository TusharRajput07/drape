import { useEffect, useEffectEvent, useRef } from 'react';

type Props = { hasMore: boolean; loading: boolean; onMore: () => void };

// Loads the next page when it scrolls near the viewport (03 §4.1).
export function InfiniteSentinel({ hasMore, loading, onMore }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useEffectEvent(onMore);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) more();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="grid place-items-center py-6" aria-hidden>
      {loading && (
        <span className="size-[22px] animate-spin rounded-full border-2 border-border border-t-accent" />
      )}
    </div>
  );
}
