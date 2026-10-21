import { z } from 'zod';

// The same rules as the server's auth.schema.ts (03 §6.1).

const encoder = new TextEncoder();

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(60, 'Use at most 60 characters.'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,24}$/, 'Use 3–24 characters: a–z, 0–9, _ or .'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Use at most 254 characters.')
    .pipe(z.email('Enter a valid email.')),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(72, 'Use at most 72 characters.')
    .refine((p) => encoder.encode(p).length <= 72, 'That password is too long.'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Enter your email.').max(254),
  password: z.string().min(1, 'Enter your password.').max(1024),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
