import { z } from 'zod';

export const signatureSchema = z.object({
  kind: z.enum(['item', 'look', 'avatar', 'cover'], 'Pick item, look, avatar or cover.'),
});

// The publicId returned by Cloudinary after a signed upload.
export const publicId = z.string().trim().min(1).max(255);

export type SignatureInput = z.infer<typeof signatureSchema>;
