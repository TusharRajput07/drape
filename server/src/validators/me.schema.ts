import { z } from 'zod';
import { name, username } from './auth.schema.js';
import { publicId } from './uploads.schema.js';

export const updateMeSchema = z.object({
  name: name.optional(),
  username: username.optional(),
});

export const updateSettingsSchema = z.object({
  accent: z.enum(['black', 'sage', 'blue', 'clay', 'plum']).optional(),
  tempUnit: z.enum(['C', 'F']).optional(),
  useLocation: z.boolean().optional(),
  // null clears the saved city
  cityName: z
    .string()
    .trim()
    .min(1, 'Enter a city.')
    .max(80, 'Use at most 80 characters.')
    .nullable()
    .optional(),
});

// PUT /me/avatar and /me/cover: an upload of that kind.
export const profileImageSchema = z.object({ publicId });

// Anything other than "DELETE" answers CONFIRMATION_REQUIRED (422), not a validation error.
export const deleteAccountSchema = z.object({ confirm: z.unknown().optional() });

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type ProfileImageInput = z.infer<typeof profileImageSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
