import { deleteOrphanUploads } from '../services/image.service.js';
import { deleteExpiredRefreshTokens } from '../services/token.service.js';

// The two clean-up jobs (02 §11). They run inside the production server (no cron needed on the host);
// `npm run job:tokens` / `npm run job:uploads` run one by hand.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export const JOBS = {
  tokens: deleteExpiredRefreshTokens,
  uploads: deleteOrphanUploads,
} satisfies Record<string, () => Promise<number>>;

export type JobName = keyof typeof JOBS;

// Each job runs a few minutes after the server starts and then on its interval, so a server that
// restarts often still runs them. Both are safe to run again at any time; a run that is still going
// is never started twice. Failures are logged and retried at the next run.
const SCHEDULE: Record<JobName, { firstAfter: number; every: number }> = {
  tokens: { firstAfter: 5 * MINUTE, every: DAY },
  uploads: { firstAfter: 10 * MINUTE, every: 7 * DAY },
};

export function startCleanupJobs() {
  for (const name of Object.keys(SCHEDULE) as JobName[]) {
    const { firstAfter, every } = SCHEDULE[name];
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await JOBS[name]();
      } catch (err) {
        console.error(err);
      } finally {
        running = false;
      }
    };
    // unref: the timers never keep the process alive on their own.
    setTimeout(() => {
      void run();
      setInterval(() => void run(), every).unref();
    }, firstAfter).unref();
  }
}
