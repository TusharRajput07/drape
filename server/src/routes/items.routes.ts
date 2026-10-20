import { Router } from 'express';
import * as items from '../controllers/items.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParams } from '../validators/common.schema.js';
import { createItemSchema, listItemsQuery, updateItemSchema } from '../validators/items.schema.js';

export const itemsRouter = Router();

itemsRouter.get('/', validate({ query: listItemsQuery }), items.list);
itemsRouter.get('/:id', validate({ params: idParams }), items.get);
itemsRouter.post('/', validate({ body: createItemSchema }), items.create);
itemsRouter.patch('/:id', validate({ params: idParams, body: updateItemSchema }), items.update);
itemsRouter.delete('/:id', validate({ params: idParams }), items.remove);
