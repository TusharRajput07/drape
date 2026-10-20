import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authRouter } from './auth.routes.js';
import { itemsRouter } from './items.routes.js';
import { looksRouter } from './looks.routes.js';
import { lookupsRouter } from './lookups.routes.js';
import { meRouter } from './me.routes.js';
import { outfitsRouter } from './outfits.routes.js';
import { statsRouter } from './stats.routes.js';
import { subcategoriesRouter } from './subcategories.routes.js';
import { uploadsRouter } from './uploads.routes.js';
import { weatherRouter } from './weather.routes.js';
import { wishlistRouter } from './wishlist.routes.js';

// Mounts every resource router under /api/v1 (see 02 §2.1).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);

// Everything below requires a logged-in user: only the four /auth routes are public (02 §6.1).
// Unknown /api/v1 paths therefore answer 401 without a token, 404 with one.
apiRouter.use(authenticate);

apiRouter.use('/me', meRouter);
apiRouter.use(lookupsRouter); // /categories, /colors
apiRouter.use('/subcategories', subcategoriesRouter);
apiRouter.use('/items', itemsRouter);
apiRouter.use('/outfits', outfitsRouter);
apiRouter.use('/looks', looksRouter);
apiRouter.use('/wishlist', wishlistRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/weather', weatherRouter);
apiRouter.use('/uploads', uploadsRouter);
