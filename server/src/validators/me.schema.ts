import { z } from 'zod';
import { name, username } from './auth.schema.js';

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

export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
