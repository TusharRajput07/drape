import { Router } from 'express';
import * as looks from '../controllers/looks.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParams, pageQuery } from '../validators/common.schema.js';
import { createLookSchema, lookItemsSchema } from '../validators/looks.schema.js';

export const looksRouter = Router();

looksRouter.get('/', validate({ query: pageQuery }), looks.list);
looksRouter.get('/:id', validate({ params: idParams }), looks.get);
looksRouter.post('/', validate({ body: createLookSchema }), looks.create);
looksRouter.put(
  '/:id/items',
  validate({ params: idParams, body: lookItemsSchema }),
  looks.setItems,
);
looksRouter.delete('/:id', validate({ params: idParams }), looks.remove);
