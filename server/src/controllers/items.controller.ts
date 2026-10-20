import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as itemService from '../services/item.service.js';
import { ok } from '../utils/api-response.js';
import type { IdParams } from '../validators/common.schema.js';
import type {
  CreateItemInput,
  ListItemsQuery,
  UpdateItemInput,
} from '../validators/items.schema.js';

export const list: RequestHandler = async (req, res) => {
  const query = req.query as unknown as ListItemsQuery;
  const { items, meta } = await itemService.list(currentUserId(req), query);
  ok(res, items, meta);
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await itemService.get(currentUserId(req), id));
};

export const create: RequestHandler = async (req, res) => {
  const input = req.body as CreateItemInput;
  ok(res, await itemService.create(currentUserId(req), input), undefined, 201);
};

export const update: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await itemService.update(currentUserId(req), id, req.body as UpdateItemInput));
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  await itemService.remove(currentUserId(req), id);
  ok(res, { deleted: true });
};
