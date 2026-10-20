import { z } from 'zod';
import { idList } from './common.schema.js';
import { publicId } from './uploads.schema.js';

// Tags: any of the user's items, de-duplicated, at most 20 (02 §8.8).
const itemIds = idList(20, 'Tag at most 20 pieces.');

export const createLookSchema = z.object({ publicId, itemIds: itemIds.default([]) });
export const lookItemsSchema = z.object({ itemIds });

export type CreateLookInput = z.infer<typeof createLookSchema>;
export type LookItemsInput = z.infer<typeof lookItemsSchema>;
