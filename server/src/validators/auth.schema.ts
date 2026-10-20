import { z } from 'zod';

// Field rules shared by signup and the profile (01 §3.1, 03 §6.1).

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Use at most 254 characters.')
  .pipe(z.email('Enter a valid email.'));

export const name = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(60, 'Use at most 60 characters.');

export const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/, 'Use 3–24 characters: a–z, 0–9, _ or .');

// bcrypt only reads the first 72 bytes, so longer (e.g. emoji-heavy) passwords are refused.
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use at most 72 characters.')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'That password is too long.');

export const signupSchema = z.object({ email, password, name, username });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter your email.').max(254),
  password: z.string().min(1, 'Enter your password.').max(1024),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
