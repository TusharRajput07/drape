import { type ReactNode, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Chip } from '@/components/Chip';
import { ColorDot } from '@/components/ColorGrid';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { ItemDetailSheet } from '@/features/closet/ItemDetailSheet';
import type { CategorySlug, Item, Stats } from '@/lib/api-types';
import { CATEGORY_SLUGS, LABEL, ONE } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { Bars } from './Bars';
import { ChartTipArea } from './ChartTip';
import { ColorDonut } from './ColorDonut';
import { useStats } from './stats.api';

type Tab = 'all' | CategorySlug;

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  ...CATEGORY_SLUGS.map((slug) => ({ id: slug, label: LABEL[slug] })),
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Card({
  title,
  sub,
  wide,
  children,
}: {
  title: string;
  sub?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 content-start gap-3.5 rounded-[20px] border border-border p-4',
        wide && 'md:col-span-2',
      )}
    >
      <div>
        <h2 className="text-base">{title}</h2>
        {sub && <p className="mt-[3px] text-[13px] text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

// Wardrobe stats: colour mix + category bars, then outfit potential, closet in use, most styled,
// palette and wishlist (03 §6.10). One GET /stats per category chip.
export function StatsPage() {
  const [tab, setTab] = useState<Tab>('all');
  const stats = useStats(tab === 'all' ? undefined : tab, { keepPrevious: true });
  const [openItem, setOpenItem] = useState<Item | null>(null);

  return (
    <section className="wrap">
      <PageHeader title="Wardrobe stats" back="/" />
      {stats.data ? (
        <ChartTipArea>
          <StatsCards stats={stats.data} tab={tab} onTab={setTab} onOpenItem={setOpenItem} />
        </ChartTipArea>
      ) : stats.isError ? (
        <EmptyState
          title="Couldn't load your stats"
          text="Check your connection and try again."
          action={
            <Button variant="ghost" onClick={() => void stats.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          <div className="h-[300px] animate-pulse rounded-[20px] bg-soft md:col-span-2" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[130px] animate-pulse rounded-[20px] bg-soft" />
          ))}
        </div>
      )}
      <ItemDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
    </section>
  );
}

type CardsProps = {
  stats: Stats;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onOpenItem: (item: Item) => void;
};

function StatsCards({ stats, tab, onTab, onOpenItem }: CardsProps) {
  const navigate = useNavigate();
  const { composition, byCategory, bySubcategory, outfitPotential, closetInUse, mostStyled } =
    stats;
  const { palette, wishlist } = stats;
  const closetTotal = closetInUse.total;
  const unused = closetTotal - closetInUse.inOutfits;
  const what = tab === 'all' ? 'clothes' : LABEL[tab].toLowerCase();

  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      <Card
        wide
        title="Wardrobe composition"
        sub={`Colours in your ${tab === 'all' ? 'closet' : LABEL[tab].toLowerCase()}`}
      >
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {TABS.map((t) => (
            <Chip key={t.id} on={tab === t.id} className="flex-none" onClick={() => onTab(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>

        {composition.total > 0 ? (
          <ColorDonut rows={composition.byColor} total={composition.total} />
        ) : (
          <p className="text-[13px] text-muted">No {what} yet.</p>
        )}

        {tab === 'all' && closetTotal > 0 && (
          <Bars
            title="By category"
            rows={byCategory.map((r) => ({
              id: r.category.id,
              label: LABEL[r.category.slug],
              count: r.count,
              percent: r.percent,
            }))}
          />
        )}
        {tab !== 'all' && bySubcategory && bySubcategory.length > 0 && (
          <Bars
            title="By subcategory"
            rows={bySubcategory.map((r) => ({
              id: r.subcategory.id,
              label: r.subcategory.name,
              count: r.count,
              percent: r.percent,
            }))}
          />
        )}
      </Card>

      <Card title="Outfit potential" sub="Every top, bottom and shoe combination you could make">
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: outfitPotential.possible.toLocaleString('en-IN'), label: 'possible' },
            { n: outfitPotential.saved, label: 'saved' },
            { n: outfitPotential.looks, label: 'looks' },
          ].map((k) => (
            <div key={k.label} className="min-w-0 rounded-[14px] bg-soft p-3">
              <b className="block text-[22px] font-semibold tabular-nums [overflow-wrap:anywhere]">
                {k.n}
              </b>
              <span className="text-xs text-muted">{k.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Closet in use"
        sub={`${closetInUse.percent}% of your clothes are in at least one outfit`}
      >
        <div
          className="h-2.5 overflow-hidden rounded bg-soft"
          data-tip={`${closetInUse.inOutfits} of ${plural(closetTotal, 'item', 'items')} in outfits`}
          role="meter"
          aria-label="Clothes in at least one outfit"
          aria-valuenow={closetInUse.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i
            className="block h-full rounded bg-accent"
            style={{ width: `${closetInUse.percent}%` }}
          />
        </div>
        <div className="text-sm">
          {closetTotal === 0 ? (
            'Add clothes to see how much of your closet you wear.'
          ) : unused > 0 ? (
            <>
              {plural(unused, 'piece has', 'pieces have')} never been styled.
              <button
                type="button"
                className="ml-1 text-[13px] font-medium text-accent underline underline-offset-2"
                onClick={() => navigate('/', { state: { showUnused: true } })}
              >
                See them
              </button>
            </>
          ) : (
            'Every piece is in an outfit. Nice.'
          )}
        </div>
      </Card>

      {mostStyled && (
        <Card title="Most styled" sub="The piece you reach for most">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => onOpenItem(mostStyled.item)}
          >
            <span className="grid size-[60px] flex-none place-items-center rounded-[14px] border border-border">
              <img src={mostStyled.item.image.url} alt="" className="size-4/5 object-contain" />
            </span>
            <span>
              <b className="font-semibold">
                {mostStyled.item.color.name} {ONE[mostStyled.item.category.slug].toLowerCase()}
              </b>
              <span className="block text-[13px] text-muted">
                In {plural(mostStyled.outfits, 'outfit', 'outfits')} and{' '}
                {plural(mostStyled.looks, 'look', 'looks')}
              </span>
            </span>
          </button>
        </Card>
      )}

      <Card
        title="Your palette"
        sub={
          closetTotal === 0
            ? 'Add clothes to see your colours.'
            : palette.neutralPercent >= 60
              ? `Mostly neutrals (${palette.neutralPercent}%). One bold piece would add range.`
              : `A good mix: ${palette.neutralPercent}% neutrals, the rest colour.`
        }
      >
        {palette.top.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {palette.top.map((c) => (
              <span
                key={c.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border pr-3 pl-2 text-[13px]"
              >
                <ColorDot hex={c.hex} className="size-4" />
                {c.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Wishlist"
        sub={`${plural(wishlist.count, 'item', 'items')} saved${
          wishlist.topSite ? `, most from ${wishlist.topSite}` : ''
        }`}
      >
        <div>
          <Button asChild variant="ghost">
            <Link to="/wishlist">Open wishlist</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
