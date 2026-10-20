// Runs the manual database checks (checks.sql) with psql against DIRECT_URL.
// Run: npm run db:check
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const url = process.env.DIRECT_URL;
if (!url) {
  console.error('DIRECT_URL is not set.');
  process.exit(1);
}

// sslmode=verify-full makes psql check Neon's certificate, and psql on Windows has no usable
// system certificate store. Hand it the same trusted roots Node uses.
const roots = join(tmpdir(), `drape-pg-roots-${process.pid}.pem`);
writeFileSync(roots, rootCertificates.join('\n'));

const result = spawnSync('psql', ['-X', '-f', 'prisma/checks/checks.sql', '-d', url], {
  stdio: 'inherit',
  env: { ...process.env, PGSSLROOTCERT: roots },
});
rmSync(roots, { force: true });

if (result.error) {
  console.error(result.error);
  console.error(
    'Could not run psql. Install the PostgreSQL client tools and put psql on your PATH.',
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
