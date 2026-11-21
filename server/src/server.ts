import { app } from './app.js';
import { env } from './config/env.js';
import { startCleanupJobs } from './jobs/cleanup.js';

app.listen(env.PORT, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  // The one non-error line the server prints, so a server that never starts is easy to spot.
  console.log(`API ready on http://localhost:${env.PORT}/api/v1`);
  // Only the production server cleans up (02 §11): a laptop's .env may point at another database
  // than the Cloudinary files belong to.
  if (env.NODE_ENV === 'production') startCleanupJobs();
});
