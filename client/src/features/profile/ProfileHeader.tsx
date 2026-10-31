import { ChartNoAxesColumn, Image, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useMe } from './me.api';

const QUICK: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/lookbooks', label: 'Lookbooks', icon: Image },
  { to: '/stats', label: 'Wardrobe stats', icon: ChartNoAxesColumn },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
];

// The prototype's faint diagonal lines, shown when there's no cover photo.
const COVER_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath d='M0 12L12 0M-3 3L3 -3M9 15L15 9' stroke='%23000' stroke-opacity='.05' stroke-width='1'/%3E%3C/svg%3E\")";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

// Cover card, overlapping name card, avatar, icon buttons and the 5 counts (03 §6.2).
// The weather pill joins the cover in phase 9.
export function ProfileHeader() {
  const me = useMe().data;
  if (!me)
    return <div className="mt-3 h-[clamp(140px,34vw,230px)] rounded-[22px] bg-accent-soft" />;

  const stats = [
    { n: me.counts.items, label: 'items', to: '/' },
    { n: me.counts.outfits, label: 'outfits', to: '/outfits' },
    { n: me.counts.looks, label: 'looks', to: '/lookbooks' },
    { n: me.counts.liked, label: 'liked', to: '/liked' },
    { n: me.counts.wishlist, label: 'wishlist', to: '/wishlist' },
  ];

  return (
    <div className="relative mt-3">
      <div
        className="h-[clamp(140px,34vw,230px)] overflow-hidden rounded-[22px] bg-accent-soft"
        style={me.cover ? undefined : { backgroundImage: COVER_PATTERN }}
      >
        {me.cover && <img src={me.cover.url} alt="" className="size-full object-cover" />}
      </div>

      <div className="relative mx-3 -mt-[34px] rounded-[20px] border border-border bg-background px-3.5 pt-[50px] pb-1 shadow-[0_1px_2px_rgba(22,22,22,.05),0_10px_28px_rgba(22,22,22,.08)] md:mx-7">
        <div className="absolute -top-11 left-3.5 grid size-[86px] place-items-center overflow-hidden rounded-full border-4 border-background bg-accent text-[30px] font-semibold text-accent-foreground shadow-[0_4px_14px_rgba(22,22,22,.14)]">
          {me.avatar ? (
            <img src={me.avatar.url} alt="" className="size-full object-cover" />
          ) : (
            initials(me.name)
          )}
        </div>

        <div className="absolute -top-[21px] right-3 flex gap-2">
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

        <div className="min-w-0">
          <h1 className="text-lg leading-tight [overflow-wrap:anywhere]">{me.name}</h1>
          <div className="text-[13px] text-muted">@{me.username}</div>
        </div>

        <div className="mt-2.5 grid grid-cols-5 border-t border-border pt-1.5 pb-0.5">
          {stats.map(({ n, label, to }) => (
            <Link
              key={label}
              to={to}
              className="grid justify-items-center gap-px rounded-[10px] py-1 hover:bg-soft"
            >
              <b className="text-[17px] font-semibold tabular-nums">{n}</b>
              <span className="text-[11.5px] text-muted">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
