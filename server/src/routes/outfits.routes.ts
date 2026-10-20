import { Router } from 'express';
import * as outfits from '../controllers/outfits.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.schema.js';
import { favouriteSchema, listOutfitsQuery, outfitSchema } from '../validators/outfits.schema.js';

export const outfitsRouter = Router();

outfitsRouter.get('/', validate({ query: listOutfitsQuery }), outfits.list);
outfitsRouter.get('/:id', validate({ params: idParams }), outfits.get);
outfitsRouter.post('/', validate({ body: outfitSchema }), outfits.create);
outfitsRouter.put('/:id', validate({ params: idParams, body: outfitSchema }), outfits.replace);
outfitsRouter.patch(
  '/:id',
  validate({ params: idParams, body: favouriteSchema }),
  outfits.setFavourite,
);
outfitsRouter.delete('/:id', validate({ params: idParams }), outfits.remove);
