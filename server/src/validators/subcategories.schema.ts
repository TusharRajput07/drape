import { z } from 'zod';
import { id } from './common.schema.js';

// Trimmed, inner spaces collapsed, 1–24 characters (02 §8.5).
const name = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1, 'Enter a name.').max(24, 'Use at most 24 characters.'));

export const listSubcategoriesQuery = z.object({ categoryId: id.optional() });
export const createSubcategorySchema = z.object({ categoryId: id, name });
export const renameSubcategorySchema = z.object({ name });

export type ListSubcategoriesQuery = z.infer<typeof listSubcategoriesQuery>;
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;
export type RenameSubcategoryInput = z.infer<typeof renameSubcategorySchema>;
