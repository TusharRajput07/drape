import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { afterCursor, orderBy, toPage, type PageMeta } from '../utils/cursor.js';
import type {
  CreateItemInput,
  ListItemsQuery,
  UpdateItemInput,
} from '../validators/items.schema.js';
import { deleteFiles, imageData, saveWithFile, verifyUpload } from './image.service.js';
import { categorySelect, colorSelect, type Category, type Color } from './lookup.service.js';
import { subcategorySelect, type Subcategory } from './subcategory.service.js';
import type { Image } from './user.service.js';

export type Item = {
  id: string;
  category: Category;
  subcategory: Subcategory;
  color: Color;
  image: Image;
  isLiked: boolean;
};

export type Usage = { outfits: number; looks: number };

// What every query that returns an Item includes (outfits, looks and stats reuse it).
export const itemInclude = {
  category: { select: categorySelect },
  subcategory: { select: subcategorySelect },
  color: { select: colorSelect },
  image: { select: { url: true, width: true, height: true } },
} as const satisfies Prisma.ItemInclude;

type ItemRow = Prisma.ItemGetPayload<{ include: typeof itemInclude }>;

export const toItem = (row: ItemRow): Item => ({
  id: row.id,
  category: row.category,
  subcategory: row.subcategory,
  color: row.color,
  image: row.image,
  isLiked: row.isLiked,
});

type Sortable = { createdAt: Date; id: string };

// Newest first: the order of accessories in an outfit and of tags on a look.
export const newestFirst = (a: Sortable, b: Sortable) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const notFound = () => new AppError('NOT_FOUND', 'Not found.', 404);

const invalidField = (field: string, message: string) =>
  new AppError('VALIDATION_ERROR', 'Some fields need fixing.', 400, [{ field, message }]);

// "This item is in 2 outfits and 1 look. Remove it from those first."
function inUseMessage({ outfits, looks }: Usage): string {
  const parts = [
    outfits > 0 ? `${outfits} ${outfits === 1 ? 'outfit' : 'outfits'}` : null,
    looks > 0 ? `${looks} ${looks === 1 ? 'look' : 'looks'}` : null,
  ].filter(Boolean);
  const where = outfits + looks > 1 ? 'those' : 'there';
  return `This item is in ${parts.join(' and ')}. Remove it from ${where} first.`;
}

async function assertSubcategory(userId: string, subcategoryId: string, categoryId: string) {
  const sub = await prisma.subcategory.findFirst({ where: { id: subcategoryId, userId } });
  if (!sub) throw invalidField('subcategoryId', 'Pick one of your subcategories.');
  if (sub.categoryId !== categoryId) {
    throw invalidField('subcategoryId', 'Pick a subcategory from the same category.');
  }
}

async function assertColor(colorId: string) {
  if (!(await prisma.color.findUnique({ where: { id: colorId }, select: { id: true } }))) {
    throw invalidField('colorId', 'Pick a colour.');
  }
}

export async function list(
  userId: string,
  query: ListItemsQuery,
): Promise<{ items: Item[]; meta: PageMeta }> {
  const where: Prisma.ItemWhereInput = {
    userId,
    ...(query.category && { category: { slug: query.category } }),
    ...(query.subcategoryId && { subcategoryId: { in: query.subcategoryId } }),
    ...(query.colorId && { colorId: { in: query.colorId } }),
    ...(query.liked && { isLiked: true }),
    ...(query.unused && { outfitItems: { none: {} } }),
  };
  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where: { AND: [where, afterCursor(query.cursor, query.sort)] },
      include: itemInclude,
      orderBy: orderBy(query.sort),
      take: query.limit + 1,
    }),
    prisma.item.count({ where }),
  ]);
  const page = toPage(rows, query.limit, total, query.sort);
  return { items: page.rows.map(toItem), meta: page.meta };
}

export async function get(userId: string, id: string): Promise<Item & { usage: Usage }> {
  const row = await prisma.item.findFirst({
    where: { id, userId },
    include: { ...itemInclude, _count: { select: { outfitItems: true, lookItems: true } } },
  });
  if (!row) throw notFound();
  return {
    ...toItem(row),
    usage: { outfits: row._count.outfitItems, looks: row._count.lookItems },
  };
}

// Checks the choices, then the upload, then saves images + items in one transaction (01 §7).
export async function create(userId: string, input: CreateItemInput): Promise<Item> {
  await assertSubcategory(userId, input.subcategoryId, input.categoryId);
  await assertColor(input.colorId);
  const file = await verifyUpload(userId, 'item', input.publicId);

  const row = await saveWithFile(file, () =>
    prisma.$transaction(async (tx) => {
      const image = await tx.image.create({ data: imageData(userId, 'item', file) });
      return tx.item.create({
        data: {
          userId,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          colorId: input.colorId,
          imageId: image.id,
        },
        include: itemInclude,
      });
    }),
  );
  return toItem(row);
}

// An item can't change category, so a new subcategory must be in the same one.
export async function update(userId: string, id: string, input: UpdateItemInput): Promise<Item> {
  const current = await prisma.item.findFirst({ where: { id, userId } });
  if (!current) throw notFound();
  if (input.subcategoryId) await assertSubcategory(userId, input.subcategoryId, current.categoryId);
  if (input.colorId) await assertColor(input.colorId);

  const row = await prisma.item.update({ where: { id }, data: input, include: itemInclude });
  return toItem(row);
}

// Blocked while in an outfit or look. Otherwise item → image rows, then the Cloudinary file.
export async function remove(userId: string, id: string): Promise<void> {
  const current = await prisma.item.findFirst({
    where: { id, userId },
    include: { image: true, _count: { select: { outfitItems: true, lookItems: true } } },
  });
  if (!current) throw notFound();

  const usage = { outfits: current._count.outfitItems, looks: current._count.lookItems };
  if (usage.outfits + usage.looks > 0) {
    throw new AppError('ITEM_IN_USE', inUseMessage(usage), 409, usage);
  }

  await prisma.$transaction(async (tx) => {
    await tx.item.delete({ where: { id } });
    await tx.image.delete({ where: { id: current.imageId } });
  });
  await deleteFiles([current.image.publicId]);
}
