import { existsSync } from 'node:fs';
import { z } from 'zod';

// Local development reads server/.env; in production the host provides the variables.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  CLIENT_URL: z.url(),

  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl,

  JWT_ACCESS_SECRET: z.string().min(64, 'must be at least 64 characters'),
  ACCESS_TOKEN_TTL: z.string().regex(/^\d+[smhd]$/, 'must look like 15m, 1h or 30s'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive(),
  COOKIE_SAMESITE: z.enum(['lax', 'none']),
  // Express 'trust proxy': a hop count ("1") or addresses/names ("loopback"). Loopback trusts only proxies on
  // this machine (the dev tunnel and vite preview); production sets it when hosting is chosen.
  TRUST_PROXY: z
    .string()
    .default('loopback')
    .transform((v) => (/^\d+$/.test(v) ? Number(v) : v)),

  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}

export const env = parsed.data;
