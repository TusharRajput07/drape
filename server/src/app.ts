import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { apiRouter } from './routes/index.js';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY); // so the rate limiter sees each client's real IP

// Security headers for everything, the built app included (02 §13):
// - cross-origin isolation (COOP same-origin + COEP credentialless, 03 §12) for background removal's
//   multi-threaded CPU fallback;
// - a Content-Security-Policy that allows exactly what the app loads: its own files, Google Fonts,
//   Cloudinary (photos and direct uploads) and img.ly's CDN for the background-removal model, whose
//   runtime is started from blob: URLs, compiles WebAssembly and uses new Function().
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginEmbedderPolicy: { policy: 'credentialless' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        manifestSrc: ["'self'"],
        // 'unsafe-eval': the background-removal library builds image functions with new Function()
        // (checked in a browser in phase 10); no inline or third-party scripts are allowed.
        scriptSrc: ["'self'", "'unsafe-eval'", "'wasm-unsafe-eval'", 'blob:'],
        workerSrc: ["'self'", 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: [
          "'self'",
          'blob:',
          'data:',
          'https://api.cloudinary.com',
          'https://res.cloudinary.com',
          'https://staticimgly.com',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
      },
    },
  }),
);

// Only the API answers cross-origin requests (from CLIENT_URL, with cookies). In production the app is
// served from this same origin, so the browser doesn't need CORS at all.
app.use('/api', cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' })); // images never go through the server
app.use(cookieParser());

app.use('/api/v1', apiRouter);

// Production: this server also serves the built client (client/dist), so the app and the API share one
// origin (the refresh cookie stays SameSite=Lax). Hashed files under /assets are cached for a year;
// everything else (index.html, the service worker, the manifest, icons) is checked again on every load,
// so a new deploy shows up straight away.
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
const indexHtml = path.join(clientDist, 'index.html');

if (env.NODE_ENV === 'production' && existsSync(indexHtml)) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, file) => {
        const hashed = path.relative(clientDist, file).startsWith(`assets${path.sep}`);
        res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    }),
  );

  // SPA fallback: any other GET page (/outfits, /settings…) gets index.html and the router takes over.
  // Paths with a file extension and anything under /api still end in the 404 envelope.
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

app.use(notFound);
app.use(errorHandler);
