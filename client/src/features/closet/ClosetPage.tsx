import { Image, SlidersHorizontal, ChartNoAxesColumn, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useMe } from '@/features/profile/me.api';

// Phase 5 stand-in for Home: phase 6 brings the profile header, tabs and grid.
const QUICK: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/lookbooks', label: 'Lookbooks', icon: Image },
  { to: '/stats', label: 'Wardrobe stats', icon: ChartNoAxesColumn },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
];

export function ClosetPage() {
  const me = useMe().data;
  return (
    <section className="wrap flex items-center gap-3 pt-5">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg leading-tight [overflow-wrap:anywhere]">{me?.name}</h1>
        {me && <p className="text-[13px] text-muted">@{me.username}</p>}
      </div>
      <div className="flex gap-2">
        {QUICK.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-label={label}
            title={label}
            className="grid size-[42px] place-items-center rounded-full border border-border bg-background text-accent shadow-[0_4px_12px_rgba(22,22,22,.1)] hover:bg-accent-soft"
          >
            <Icon className="size-[19px]" strokeWidth={1.8} aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}
