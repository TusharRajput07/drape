import { AppError } from './app-error.js';

// Cursor pagination (02 §7). Lists are ordered by (created_at, id), newest or oldest first.
// The cursor is base64url of { t: created_at of the last row, id: its id, s: the sort }.

export type Sort = 'newest' | 'oldest';
export type Page = { limit: number; cursor?: string | undefined };
export type PageMeta = {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

type Row = { createdAt: Date; id: string };
type Position = { createdAt: Date; id: string };

const invalidCursor = () =>
  new AppError('VALIDATION_ERROR', 'Some fields need fixing.', 400, [
    { field: 'cursor', message: 'That page link has expired. Reload the list.' },
  ]);

export function encodeCursor(row: Row, sort: Sort): string {
  return Buffer.from(
    JSON.stringify({ t: row.createdAt.toISOString(), id: row.id, s: sort }),
  ).toString('base64url');
}

function decodeCursor(cursor: string, sort: Sort): Position {
  try {
    const { t, id, s } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      t?: unknown;
      id?: unknown;
      s?: unknown;
    };
    const createdAt = new Date(typeof t === 'string' ? t : NaN);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      s !== sort ||
      typeof id !== 'string' ||
      !uuid.test(id) ||
      Number.isNaN(createdAt.getTime())
    ) {
      throw invalidCursor();
    }
    return { createdAt, id };
  } catch {
    throw invalidCursor();
  }
}

// The Prisma orderBy for a sort.
export function orderBy(sort: Sort) {
  const dir = sort === 'newest' ? ('desc' as const) : ('asc' as const);
  return [{ createdAt: dir }, { id: dir }];
}

// The Prisma where for "rows after the cursor": (created_at, id) < (t, id) for newest, > for oldest.
export function afterCursor(cursor: string | undefined, sort: Sort) {
  if (!cursor) return {};
  const { createdAt, id } = decodeCursor(cursor, sort);
  return sort === 'newest'
    ? { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: id } }] }
    : { OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: id } }] };
}

// Rows were fetched with take: limit + 1; the extra row only says whether there's another page.
export function toPage<T extends Row>(
  rows: T[],
  limit: number,
  total: number,
  sort: Sort,
): { rows: T[]; meta: PageMeta } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    rows: page,
    meta: { limit, nextCursor: hasMore && last ? encodeCursor(last, sort) : null, hasMore, total },
  };
}
