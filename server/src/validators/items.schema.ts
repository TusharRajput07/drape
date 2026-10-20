import { z } from 'zod';
import { flag, id, many, pageQuery } from './common.schema.js';
import { publicId } from './uploads.schema.js';

export const categorySlug = z.enum(
  ['top', 'bottom', 'shoes', 'accessory'],
  'Pick top, bottom, shoes or accessory.',
);

// GET /items filters, combined with AND; repeated ids are OR'ed (02 §8.6).
export const listItemsQuery = pageQuery.extend({
  category: categorySlug.optional(),
  subcategoryId: many(id).optional(),
  colorId: many(id).optional(),
  liked: flag.optional(),
  unused: flag.optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const createItemSchema = z.object({
  publicId,
  categoryId: id,
  subcategoryId: id,
  colorId: id,
});

export const updateItemSchema = z.object({
  subcategoryId: id.optional(),
  colorId: id.optional(),
  isLiked: z.boolean().optional(),
});

export type ListItemsQuery = z.infer<typeof listItemsQuery>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
