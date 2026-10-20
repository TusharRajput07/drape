import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Local development reads server/.env; in production the host provides the variables.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// The Prisma CLI (migrations, seed) uses the direct Neon connection; the app uses the pooled
// DATABASE_URL through the pg adapter (src/db/prisma.ts, phase 3).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
