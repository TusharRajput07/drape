import { Prisma } from '../generated/prisma/client.js';
import { AppError, type ErrorCode } from './app-error.js';

// Maps database errors to API errors (01 §8, 02 §9). Errors arrive two ways:
// - wrapped by Prisma (P2002, P2003, P2025, P2039…) with the driver's details in meta, or
// - as a raw DriverAdapterError when they're raised at COMMIT (the deferred outfit trigger
//   and the deferred "block" foreign keys) inside a $transaction.

type DriverCause = {
  originalCode?: string;
  originalMessage?: string;
  constraint?: { index?: string };
};

type Mapping = { code: ErrorCode; status: number; message: string; field?: string };

const UNIQUE: Record<string, Mapping> = {
  users_email_key: {
    code: 'EMAIL_TAKEN',
    status: 409,
    message: 'An account with this email already exists.',
    field: 'email',
  },
  users_username_key: {
    code: 'USERNAME_TAKEN',
    status: 409,
    message: 'That username is taken.',
    field: 'username',
  },
  subcategories_user_id_category_id_name_key: {
    code: 'SUBCATEGORY_EXISTS',
    status: 409,
    message: 'That subcategory already exists in this category.',
    field: 'name',
  },
  outfits_user_signature_key: {
    code: 'OUTFIT_DUPLICATE',
    status: 409,
    message: 'You already saved this outfit.',
  },
  // The same uploaded file sent twice at once (image.service checks first; this is the race).
  images_public_id_key: {
    code: 'UPLOAD_INVALID',
    status: 400,
    message: 'That photo is already saved.',
  },
  wishlist_user_url_key: {
    code: 'WISHLIST_DUPLICATE',
    status: 409,
    message: 'Already in your wishlist.',
    field: 'url',
  },
};

// The deferred "block" foreign keys (01 §2). Services count usage first; these are the safety net.
const IN_USE: Record<string, Mapping> = {
  outfit_items_item_id_user_id_category_id_fkey: {
    code: 'ITEM_IN_USE',
    status: 409,
    message: 'This is still used in an outfit. Remove it from there first.',
  },
  look_items_item_id_user_id_fkey: {
    code: 'ITEM_IN_USE',
    status: 409,
    message: 'This is still used in a look. Remove it from there first.',
  },
  items_subcategory_fk: {
    code: 'SUBCATEGORY_IN_USE',
    status: 409,
    message: 'This subcategory still has items. Move or delete them first.',
  },
};

// Longest first, so user_settings_* isn't read as users_*.
const TABLES = [
  'subcategory_templates',
  'wishlist_items',
  'refresh_tokens',
  'user_settings',
  'subcategories',
  'outfit_items',
  'categories',
  'look_items',
  'images',
  'outfits',
  'colors',
  'items',
  'looks',
  'users',
];

function driverCause(err: unknown): DriverCause | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta as { driverAdapterError?: { cause?: DriverCause } } | undefined;
    return meta?.driverAdapterError?.cause;
  }
  if (err instanceof Error && err.name === 'DriverAdapterError') {
    return (err as Error & { cause?: DriverCause }).cause;
  }
  return undefined;
}

const toAppError = ({ code, status, message, field }: Mapping) =>
  new AppError(code, message, status, field ? [{ field, message }] : undefined);

// CHECKs are named <table>_<column>_check (01 §4), e.g. user_settings_city_lat_check → cityLat.
function checkField(constraint: string): string {
  const table = TABLES.find((t) => constraint.startsWith(`${t}_`));
  const column = constraint.slice(table ? table.length + 1 : 0).replace(/_check$/, '');
  return column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// Returns the matching AppError, or null when the error isn't a known database error.
export function fromPrismaError(err: unknown): AppError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    return new AppError('NOT_FOUND', 'Not found.', 404);
  }

  const cause = driverCause(err);
  if (!cause) return null;
  const constraint = cause.constraint?.index ?? '';

  switch (cause.originalCode) {
    case '23505': {
      const mapping = UNIQUE[constraint];
      return mapping ? toAppError(mapping) : null;
    }
    case '23503': {
      const mapping = IN_USE[constraint];
      return mapping ? toAppError(mapping) : null;
    }
    case '23514': {
      const check = cause.originalMessage?.match(/violates check constraint "([a-z0-9_]+)"/)?.[1];
      if (!check) {
        // Raised by check_outfit(): the outfit breaks the per-category counts.
        return new AppError(
          'OUTFIT_INVALID',
          'An outfit needs 1 top and 1 bottom, and at most 1 pair of shoes.',
          422,
        );
      }
      const field = checkField(check);
      return new AppError('VALIDATION_ERROR', 'Some fields need fixing.', 400, [
        { field, message: 'This value is not allowed.' },
      ]);
    }
    default:
      return null;
  }
}
