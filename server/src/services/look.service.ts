import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { afterCursor, orderBy, toPage, type Page, type PageMeta } from '../utils/cursor.js';
import type { CreateLookInput, LookItemsInput } from '../validators/looks.schema.js';
import { deleteFiles, imageData, saveWithFile, verifyUpload } from './image.service.js';
import { itemInclude, newestFirst, toItem, type Item } from './item.service.js';
import type { Image } from './user.service.js';

export type Look = { id: string; image: Image; items: Item[] };

const lookInclude = {
  image: { select: { url: true, width: true, height: true } },
  items: { include: { item: { include: itemInclude } } },
} as const satisfies Prisma.LookInclude;

type LookRow = Prisma.LookGetPayload<{ include: typeof lookInclude }>;

const notFound = () => new AppError('NOT_FOUND', 'Not found.', 404);

const toLook = (row: LookRow): Look => ({
  id: row.id,
  image: row.image,
  items: row.items
    .map((li) => li.item)
    .sort(newestFirst)
    .map(toItem),
});

// Every tagged item must be the user's own.
async function assertOwnItems(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return;
  const count = await prisma.item.count({ where: { userId, id: { in: itemIds } } });
  if (count !== itemIds.length) {
    throw new AppError('VALIDATION_ERROR', 'Some fields need fixing.', 400, [
      { field: 'itemIds', message: 'Tag only pieces from your closet.' },
    ]);
  }
}

async function find(userId: string, id: string): Promise<Look> {
  const row = await prisma.look.findFirst({ where: { id, userId }, include: lookInclude });
  if (!row) throw notFound();
  return toLook(row);
}

export async function list(
  userId: string,
  query: Page,
): Promise<{ looks: Look[]; meta: PageMeta }> {
  const [rows, total] = await Promise.all([
    prisma.look.findMany({
      where: { userId, ...afterCursor(query.cursor, 'newest') },
      include: lookInclude,
      orderBy: orderBy('newest'),
      take: query.limit + 1,
    }),
    prisma.look.count({ where: { userId } }),
  ]);
  const page = toPage(rows, query.limit, total, 'newest');
  return { looks: page.rows.map(toLook), meta: page.meta };
}

export const get = find;

// images (kind look) → looks → look_items, in one transaction (01 §7).
export async function create(userId: string, input: CreateLookInput): Promise<Look> {
  await assertOwnItems(userId, input.itemIds);
  const file = await verifyUpload(userId, 'look', input.publicId);

  const look = await saveWithFile(file, () =>
    prisma.$transaction(async (tx) => {
      const image = await tx.image.create({ data: imageData(userId, 'look', file) });
      const created = await tx.look.create({ data: { userId, imageId: image.id } });
      await tx.lookItem.createMany({
        data: input.itemIds.map((itemId) => ({ lookId: created.id, userId, itemId })),
      });
      return created;
    }),
  );
  return find(userId, look.id);
}

// Replaces the tags.
export async function setItems(userId: string, id: string, input: LookItemsInput): Promise<Look> {
  if (!(await prisma.look.findFirst({ where: { id, userId }, select: { id: true } }))) {
    throw notFound();
  }
  await assertOwnItems(userId, input.itemIds);
  await prisma.$transaction(async (tx) => {
    await tx.lookItem.deleteMany({ where: { lookId: id, userId } });
    await tx.lookItem.createMany({
      data: input.itemIds.map((itemId) => ({ lookId: id, userId, itemId })),
    });
  });
  return find(userId, id);
}

// looks (tags cascade) → images, then the Cloudinary file.
export async function remove(userId: string, id: string): Promise<void> {
  const current = await prisma.look.findFirst({ where: { id, userId }, include: { image: true } });
  if (!current) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.look.delete({ where: { id } });
    await tx.image.delete({ where: { id: current.imageId } });
  });
  await deleteFiles([current.image.publicId]);
}
