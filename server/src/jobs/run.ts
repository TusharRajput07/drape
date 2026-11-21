import { prisma } from '../db/prisma.js';
import { JOBS, type JobName } from './cleanup.js';

// Runs one clean-up job by hand: `npm run job:tokens` or `npm run job:uploads` (02 §11).
// Careful: the uploads job compares Cloudinary with *this* .env's database, so only run it against the
// database that owns those Cloudinary files.
const name = process.argv[2] as JobName | undefined;

if (!name || !(name in JOBS)) {
  console.error(`Usage: tsx src/jobs/run.ts <${Object.keys(JOBS).join('|')}>`);
  process.exit(1);
}

try {
  // Silent on success (no logging beyond errors, 02 §9); a failure prints and exits with 1.
  await JOBS[name]();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
