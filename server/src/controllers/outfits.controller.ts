import type { RequestHandler } from 'express';
import { currentUserId } from '../middlewares/authenticate.js';
import * as outfitService from '../services/outfit.service.js';
import { ok } from '../utils/api-response.js';
import type { IdParams } from '../validators/common.schema.js';
import type {
  FavouriteInput,
  ListOutfitsQuery,
  OutfitInput,
} from '../validators/outfits.schema.js';

export const list: RequestHandler = async (req, res) => {
  const query = req.query as unknown as ListOutfitsQuery;
  const { outfits, meta } = await outfitService.list(currentUserId(req), query);
  ok(res, outfits, meta);
};

export const get: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await outfitService.get(currentUserId(req), id));
};

export const create: RequestHandler = async (req, res) => {
  const input = req.body as OutfitInput;
  ok(res, await outfitService.create(currentUserId(req), input), undefined, 201);
};

export const replace: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await outfitService.replace(currentUserId(req), id, req.body as OutfitInput));
};

export const setFavourite: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  ok(res, await outfitService.setFavourite(currentUserId(req), id, req.body as FavouriteInput));
};

export const remove: RequestHandler = async (req, res) => {
  const { id } = req.params as IdParams;
  await outfitService.remove(currentUserId(req), id);
  ok(res, { deleted: true });
};
