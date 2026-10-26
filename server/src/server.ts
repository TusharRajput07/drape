import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  // The one non-error line the server prints, so a server that never starts is easy to spot.
  console.log(`API ready on http://localhost:${env.PORT}/api/v1`);
});
