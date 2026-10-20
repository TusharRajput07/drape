import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { afterCursor, orderBy, toPage, type PageMeta } from '../utils/cursor.js';
import type {
  FavouriteInput,
  ListOutfitsQuery,
  OutfitInput,
} from '../validators/outfits.schema.js';
import { itemInclude, newestFirst, toItem, type Item } from './item.service.js';

export type Outfit = {
  id: string;
  isFavourite: boolean;
  top: Item;
  bottom: Item;
  shoes: Item | null;
  accessories: Item[];
};

const outfitInclude = {
  items: { include: { item: { include: itemInclude } } },
} as const satisfies Prisma.OutfitInclude;

type OutfitRow = Prisma.OutfitGetPayload<{ include: typeof outfitInclude }>;

const notFound = () => new AppError('NOT_FOUND', 'Not found.', 404);

const outfitInvalid = () =>
  new AppError(
    'OUTFIT_INVALID',
    'An outfit needs 1 top and 1 bottom, and at most 1 pair of shoes.',
    422,
  );

function toOutfit(row: OutfitRow): Outfit {
  const items = row.items.map((oi) => oi.item).sort(newestFirst);
  const top = items.find((i) => i.category.slug === 'top');
  const bottom = items.find((i) => i.category.slug === 'bottom');
  // The deferred trigger guarantees both exist for every committed outfit.
  if (!top || !bottom) throw new Error(`Outfit ${row.id} has no top or bottom`);
  const shoes = items.find((i) => i.category.slug === 'shoes');
  return {
    id: row.id,
    isFavourite: row.isFavourite,
    top: toItem(top),
    bottom: toItem(bottom),
    shoes: shoes ? toItem(shoes) : null,
    accessories: items.filter((i) => i.category.slug === 'accessory').map(toItem),
  };
}

// Every piece must be the user's own and in its slot's category (otherwise OUTFIT_INVALID).
// Returns the outfit_items rows to insert.
async function pieces(userId: string, input: OutfitInput) {
  const slots = [
    { id: input.topId, slug: 'top' },
    { id: input.bottomId, slug: 'bottom' },
    ...(input.shoesId ? [{ id: input.shoesId, slug: 'shoes' }] : []),
    ...input.accessoryIds.map((id) => ({ id, slug: 'accessory' })),
  ];
  const ids = new Set(slots.map((s) => s.id));
  if (ids.size !== slots.length) throw outfitInvalid(); // the same item in two slots

  const found = await prisma.item.findMany({
    where: { userId, id: { in: [...ids] } },
    select: { id: true, categoryId: true, category: { select: { slug: true } } },
  });
  const byId = new Map(found.map((i) => [i.id, i]));
  return slots.map((slot) => {
    const item = byId.get(slot.id);
    if (!item || item.category.slug !== slot.slug) throw outfitInvalid();
    return { itemId: item.id, categoryId: item.categoryId };
  });
}

async function find(userId: string, id: string): Promise<Outfit> {
  const row = await prisma.outfit.findFirst({ where: { id, userId }, include: outfitInclude });
  if (!row) throw notFound();
  return toOutfit(row);
}

export async function list(
  userId: string,
  query: ListOutfitsQuery,
): Promise<{ outfits: Outfit[]; meta: PageMeta }> {
  const where: Prisma.OutfitWhereInput = {
    userId,
    ...(query.favourite && { isFavourite: true }),
  };
  const [rows, total] = await Promise.all([
    prisma.outfit.findMany({
      where: { AND: [where, afterCursor(query.cursor, 'newest')] },
      include: outfitInclude,
      orderBy: orderBy('newest'),
      take: query.limit + 1,
    }),
    prisma.outfit.count({ where }),
  ]);
  const page = toPage(rows, query.limit, total, 'newest');
  return { outfits: page.rows.map(toOutfit), meta: page.meta };
}

export const get = find;

// One transaction; at COMMIT the deferred trigger checks the counts and sets the signature.
// A duplicate arrives as OUTFIT_DUPLICATE, a broken count rule as OUTFIT_INVALID (prisma-errors).
export async function create(userId: string, input: OutfitInput): Promise<Outfit> {
  const rows = await pieces(userId, input);
  const outfit = await prisma.$transaction(async (tx) => {
    const created = await tx.outfit.create({ data: { userId } });
    await tx.outfitItem.createMany({
      data: rows.map((r) => ({ ...r, outfitId: created.id, userId })),
    });
    return created;
  });
  return find(userId, outfit.id);
}

// Replaces the pieces. Saving the same pieces as itself is fine.
export async function replace(userId: string, id: string, input: OutfitInput): Promise<Outfit> {
  if (!(await prisma.outfit.findFirst({ where: { id, userId }, select: { id: true } }))) {
    throw notFound();
  }
  const rows = await pieces(userId, input);
  await prisma.$transaction(async (tx) => {
    await tx.outfitItem.deleteMany({ where: { outfitId: id, userId } });
    await tx.outfitItem.createMany({ data: rows.map((r) => ({ ...r, outfitId: id, userId })) });
  });
  return find(userId, id);
}

export async function setFavourite(
  userId: string,
  id: string,
  input: FavouriteInput,
): Promise<Outfit> {
  const { count } = await prisma.outfit.updateMany({
    where: { id, userId },
    data: { isFavourite: input.isFavourite },
  });
  if (count === 0) throw notFound();
  return find(userId, id);
}

// Its outfit_items rows cascade.
export async function remove(userId: string, id: string): Promise<void> {
  const { count } = await prisma.outfit.deleteMany({ where: { id, userId } });
  if (count === 0) throw notFound();
}
