import { z } from 'zod';
import { flag, id, idList, pageQuery } from './common.schema.js';

export const listOutfitsQuery = pageQuery.extend({ favourite: flag.optional() });

// POST and PUT: the pieces. Accessories are de-duplicated, at most 10 (02 §8.7).
export const outfitSchema = z.object({
  topId: id,
  bottomId: id,
  shoesId: id.nullable().optional(),
  accessoryIds: idList(10, 'Pick at most 10 accessories.').default([]),
});

export const favouriteSchema = z.object({ isFavourite: z.boolean() });

export type ListOutfitsQuery = z.infer<typeof listOutfitsQuery>;
export type OutfitInput = z.infer<typeof outfitSchema>;
export type FavouriteInput = z.infer<typeof favouriteSchema>;
