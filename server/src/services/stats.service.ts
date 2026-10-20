import { prisma } from '../db/prisma.js';
import type { StatsQuery } from '../validators/stats.schema.js';
import { itemInclude, toItem, type Item } from './item.service.js';
import { categorySelect, colorSelect, type Category, type Color } from './lookup.service.js';
import { subcategorySelect, type Subcategory } from './subcategory.service.js';

// Wardrobe stats (02 §8.10). Counted with aggregate queries, never by loading every item.

type Share<K extends string, T> = { [key in K]: T } & { count: number; percent: number };

export type Stats = {
  composition: { total: number; byColor: Share<'color', Color>[] };
  bySubcategory: Share<'subcategory', Subcategory>[] | null;
  byCategory: Share<'category', Category>[];
  outfitPotential: { possible: number; saved: number; looks: number };
  closetInUse: { inOutfits: number; total: number; percent: number };
  mostStyled: { item: Item; outfits: number; looks: number } | null;
  palette: { neutralPercent: number; top: Color[] };
  wishlist: { count: number; topSite: string | null };
};

const percent = (count: number, total: number) =>
  total > 0 ? Math.round((count * 100) / total) : 0;

// Biggest first; ties keep the lookup's own order (colours by sort_order, subcategories by name).
const byCountDesc = <T extends { count: number }>(rows: T[]) =>
  rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => b.row.count - a.row.count || a.i - b.i)
    .map((x) => x.row);

export async function get(userId: string, query: StatsQuery): Promise<Stats> {
  const [categories, colors] = await Promise.all([
    prisma.category.findMany({ select: { ...categorySelect }, orderBy: { sortOrder: 'asc' } }),
    prisma.color.findMany({
      select: { ...colorSelect, isNeutral: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  const category = query.category ? categories.find((c) => c.slug === query.category) : undefined;

  const [perCategory, perColorAll, perColorFiltered, perSubcategory, outfits, looks] =
    await Promise.all([
      prisma.item.groupBy({ by: ['categoryId'], where: { userId }, _count: { _all: true } }),
      prisma.item.groupBy({ by: ['colorId'], where: { userId }, _count: { _all: true } }),
      category
        ? prisma.item.groupBy({
            by: ['colorId'],
            where: { userId, categoryId: category.id },
            _count: { _all: true },
          })
        : null,
      category
        ? prisma.item.groupBy({
            by: ['subcategoryId'],
            where: { userId, categoryId: category.id },
            _count: { _all: true },
          })
        : null,
      prisma.outfit.count({ where: { userId } }),
      prisma.look.count({ where: { userId } }),
    ]);

  const [inUse, styled, wishlistCount, sites] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT item_id) AS n FROM outfit_items WHERE user_id = ${userId}::uuid`,
    // Highest outfits + looks; ties → newest. Items in nothing don't count as "styled".
    prisma.$queryRaw<{ id: string; outfits: bigint; looks: bigint }[]>`
      SELECT id, outfits, looks FROM (
        SELECT i.id, i.created_at,
               (SELECT count(*) FROM outfit_items oi WHERE oi.item_id = i.id) AS outfits,
               (SELECT count(*) FROM look_items li WHERE li.item_id = i.id) AS looks
          FROM items i
         WHERE i.user_id = ${userId}::uuid
      ) usage
      ORDER BY outfits + looks DESC, created_at DESC, id DESC
      LIMIT 1`,
    prisma.wishlistItem.count({ where: { userId } }),
    prisma.wishlistItem.groupBy({
      by: ['siteName'],
      where: { userId },
      _count: { _all: true },
      orderBy: [{ _count: { siteName: 'desc' } }, { siteName: 'asc' }],
      take: 1,
    }),
  ]);

  // Whole closet
  const total = perCategory.reduce((sum, r) => sum + r._count._all, 0);
  const categoryCount = new Map(perCategory.map((r) => [r.categoryId, r._count._all]));
  const countOf = (slug: string) =>
    categoryCount.get(categories.find((c) => c.slug === slug)?.id ?? '') ?? 0;

  const byCategory = categories.map((c) => {
    const count = categoryCount.get(c.id) ?? 0;
    return { category: c, count, percent: percent(count, total) };
  });

  const colorShares = (rows: typeof perColorAll, of: number) => {
    const counts = new Map(rows.map((r) => [r.colorId, r._count._all]));
    return byCountDesc(
      colors
        .filter((c) => counts.has(c.id))
        .map(({ isNeutral: _, ...color }) => {
          const count = counts.get(color.id) ?? 0;
          return { color, count, percent: percent(count, of) };
        }),
    );
  };

  // Filtered by ?category
  const compositionRows = perColorFiltered ?? perColorAll;
  const compositionTotal = compositionRows.reduce((sum, r) => sum + r._count._all, 0);

  let bySubcategory: Stats['bySubcategory'] = null;
  if (category && perSubcategory) {
    const subcategories = await prisma.subcategory.findMany({
      where: { userId, id: { in: perSubcategory.map((r) => r.subcategoryId) } },
      select: subcategorySelect,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const counts = new Map(perSubcategory.map((r) => [r.subcategoryId, r._count._all]));
    bySubcategory = byCountDesc(
      subcategories.map((subcategory) => {
        const count = counts.get(subcategory.id) ?? 0;
        return { subcategory, count, percent: percent(count, compositionTotal) };
      }),
    );
  }

  const neutralIds = new Set(colors.filter((c) => c.isNeutral).map((c) => c.id));
  const neutral = perColorAll
    .filter((r) => neutralIds.has(r.colorId))
    .reduce((sum, r) => sum + r._count._all, 0);

  let mostStyled: Stats['mostStyled'] = null;
  const top = styled[0];
  if (top && Number(top.outfits) + Number(top.looks) > 0) {
    const row = await prisma.item.findFirst({
      where: { id: top.id, userId },
      include: itemInclude,
    });
    if (row)
      mostStyled = { item: toItem(row), outfits: Number(top.outfits), looks: Number(top.looks) };
  }

  const inOutfits = Number(inUse[0]?.n ?? 0);

  return {
    composition: {
      total: compositionTotal,
      byColor: colorShares(compositionRows, compositionTotal),
    },
    bySubcategory,
    byCategory,
    outfitPotential: {
      possible: countOf('top') * countOf('bottom') * Math.max(1, countOf('shoes')),
      saved: outfits,
      looks,
    },
    closetInUse: { inOutfits, total, percent: percent(inOutfits, total) },
    mostStyled,
    palette: {
      neutralPercent: percent(neutral, total),
      top: colorShares(perColorAll, total)
        .slice(0, 3)
        .map((share) => share.color),
    },
    wishlist: { count: wishlistCount, topSite: sites[0]?.siteName ?? null },
  };
}
