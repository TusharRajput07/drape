import { z } from 'zod';

// Pieces shared by the resource schemas.

export const id = z.uuid('Pick a valid option.');

// Path ids. A malformed one answers 404 like any id that isn't yours (middlewares/validate.ts).
export const idParams = z.object({ id: z.uuid() });

// Cursor pagination (02 §7).
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(24),
  cursor: z.string().min(1).max(512).optional(),
});

// A repeatable query value (?colorId=a&colorId=b) arrives as a string or an array.
export const many = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === undefined || Array.isArray(v) ? v : [v]), z.array(schema).max(50));

// ?liked=true. "false" means no filter.
export const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

// A list of ids in a body, with duplicates removed.
export const idList = (max: number, message: string) =>
  z
    .array(id)
    .transform((ids) => [...new Set(ids)])
    .pipe(z.array(z.string()).max(max, message));

export type PageQuery = z.infer<typeof pageQuery>;
export type IdParams = z.infer<typeof idParams>;
