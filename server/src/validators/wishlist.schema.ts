import { z } from 'zod';

export const addWishlistSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Paste a link.')
    .max(2048, 'That link is too long.')
    .pipe(
      z.url({
        protocol: /^https?$/,
        message: 'Paste a link that starts with http:// or https://.',
      }),
    ),
});

export type AddWishlistInput = z.infer<typeof addWishlistSchema>;
