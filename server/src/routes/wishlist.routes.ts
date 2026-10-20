import { Router } from 'express';
import * as wishlist from '../controllers/wishlist.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParams, pageQuery } from '../validators/common.schema.js';
import { addWishlistSchema } from '../validators/wishlist.schema.js';

export const wishlistRouter = Router();

wishlistRouter.get('/', validate({ query: pageQuery }), wishlist.list);
wishlistRouter.post('/', validate({ body: addWishlistSchema }), wishlist.add);
wishlistRouter.delete('/:id', validate({ params: idParams }), wishlist.remove);
