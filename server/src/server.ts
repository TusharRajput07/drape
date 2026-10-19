import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
