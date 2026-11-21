import { z } from 'zod';

// Name and username rules, the same as the server's auth.schema.ts (03 §6.1). Signup and the
// Settings profile form both use them.

export const nameRule = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(60, 'Use at most 60 characters.');

export const usernameRule = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/, 'Use 3–24 characters: a–z, 0–9, _ or .');

export const profileSchema = z.object({ name: nameRule, username: usernameRule });

export type ProfileInput = z.infer<typeof profileSchema>;
