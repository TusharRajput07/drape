import { z } from 'zod';
import { categorySlug } from './items.schema.js';

export const statsQuery = z.object({ category: categorySlug.optional() });

export type StatsQuery = z.infer<typeof statsQuery>;
