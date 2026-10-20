import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as wishlistService from '../services/wishlist.service.js';
import { ok } from '../utils/api-response.js';
import type { IdParams, PageQuery } from '../validators/common.schema.js';
import type { AddWishlistInput } from '../validators/wishlist.schema.js';

export const list: RequestHandler = async (req, res) => {
  const query = req.query as unknown as PageQuery;
  const { items, meta } = await wishlistService.list(currentUserId(req), query);
  ok(res, items, meta);
};

export const add: RequestHandler = async (req, res) => {
  const input = req.body as AddWishlistInput;
  ok(res, await wishlistService.add(currentUserId(req), input), undefined, 201);
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  await wishlistService.remove(currentUserId(req), id);
  ok(res, { deleted: true });
};
