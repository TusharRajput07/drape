import express from 'express';
import { errorHandler } from './middlewares/error-handler.js';
import { notFound } from './middlewares/not-found.js';
import { apiRouter } from './routes/index.js';

export const app = express();

// Phase 3 adds helmet, cors, the JSON body limit and cookie-parser here, before the routes.

app.use('/api/v1', apiRouter);

app.use(notFound);
app.use(errorHandler);
