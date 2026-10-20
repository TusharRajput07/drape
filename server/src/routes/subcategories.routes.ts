import { Router } from 'express';
import * as subcategories from '../controllers/subcategories.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.schema.js';
import {
  createSubcategorySchema,
  listSubcategoriesQuery,
  renameSubcategorySchema,
} from '../validators/subcategories.schema.js';

export const subcategoriesRouter = Router();

subcategoriesRouter.get('/', validate({ query: listSubcategoriesQuery }), subcategories.list);
subcategoriesRouter.post('/', validate({ body: createSubcategorySchema }), subcategories.create);
subcategoriesRouter.patch(
  '/:id',
  validate({ params: idParams, body: renameSubcategorySchema }),
  subcategories.rename,
);
subcategoriesRouter.delete('/:id', validate({ params: idParams }), subcategories.remove);
