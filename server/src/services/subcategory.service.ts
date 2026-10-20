import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/app-error.js';
import { fromPrismaError } from '../utils/prisma-errors.js';
import type {
  CreateSubcategoryInput,
  ListSubcategoriesQuery,
  RenameSubcategoryInput,
} from '../validators/subcategories.schema.js';

export type Subcategory = { id: string; categoryId: string; name: string; itemCount?: number };

export const subcategorySelect = { id: true, categoryId: true, name: true } as const;

const notFound = () => new AppError('NOT_FOUND', 'Not found.', 404);

// "Kurtas" already exists in Tops. (01 §8)
async function rethrowDuplicate(err: unknown, name: string, categoryId: string): Promise<never> {
  if (fromPrismaError(err)?.code === 'SUBCATEGORY_EXISTS') {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    const message = `"${name}" already exists in ${category?.name ?? 'this category'}.`;
    throw new AppError('SUBCATEGORY_EXISTS', message, 409, [{ field: 'name', message }]);
  }
  throw err;
}

// By category, then the user's order, then name. Not paginated (a few dozen at most).
export async function list(userId: string, query: ListSubcategoriesQuery): Promise<Subcategory[]> {
  const rows = await prisma.subcategory.findMany({
    where: { userId, categoryId: query.categoryId },
    select: { ...subcategorySelect, _count: { select: { items: true } } },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(({ _count, ...s }) => ({ ...s, itemCount: _count.items }));
}

// A new subcategory goes to the end of its category.
export async function create(userId: string, input: CreateSubcategoryInput): Promise<Subcategory> {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) {
    throw new AppError('VALIDATION_ERROR', 'Some fields need fixing.', 400, [
      { field: 'categoryId', message: 'Pick a category.' },
    ]);
  }
  const last = await prisma.subcategory.aggregate({
    where: { userId, categoryId: input.categoryId },
    _max: { sortOrder: true },
  });
  try {
    const row = await prisma.subcategory.create({
      data: {
        userId,
        categoryId: input.categoryId,
        name: input.name,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
      select: subcategorySelect,
    });
    return { ...row, itemCount: 0 };
  } catch (err) {
    return rethrowDuplicate(err, input.name, input.categoryId);
  }
}

export async function rename(
  userId: string,
  id: string,
  input: RenameSubcategoryInput,
): Promise<Subcategory> {
  const current = await prisma.subcategory.findFirst({ where: { id, userId } });
  if (!current) throw notFound();
  try {
    const row = await prisma.subcategory.update({
      where: { id },
      data: { name: input.name },
      select: { ...subcategorySelect, _count: { select: { items: true } } },
    });
    const { _count, ...s } = row;
    return { ...s, itemCount: _count.items };
  } catch (err) {
    return rethrowDuplicate(err, input.name, current.categoryId);
  }
}

// Blocked while items use it; the deferred foreign key is the safety net (01 §2).
export async function remove(userId: string, id: string): Promise<void> {
  const current = await prisma.subcategory.findFirst({
    where: { id, userId },
    include: { _count: { select: { items: true } } },
  });
  if (!current) throw notFound();

  const items = current._count.items;
  if (items > 0) {
    throw new AppError(
      'SUBCATEGORY_IN_USE',
      `"${current.name}" still has ${items} ${items === 1 ? 'item' : 'items'}. Move or delete them first.`,
      409,
      { items },
    );
  }
  await prisma.subcategory.deleteMany({ where: { id, userId } });
}
