import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authRouter } from './auth.routes.js';
import { meRouter } from './me.routes.js';

// Mounts every resource router under /api/v1 (see 02 §2.1).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);

// Everything below requires a logged-in user: only the four /auth routes are public (02 §6.1).
// Unknown /api/v1 paths therefore answer 401 without a token, 404 with one.
apiRouter.use(authenticate);

apiRouter.use('/me', meRouter);
